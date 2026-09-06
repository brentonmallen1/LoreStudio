"""
The semantic index: what it contains, what a rebuild costs, and what a search returns.

Two properties matter more than the rest. A rebuild must keep the vectors of text that did
not change, because otherwise fixing a typo re-embeds a novel. And a search must never
compare vectors from different embedding models — the numbers are meaningless across
models, and silently mixing them would return confident nonsense.
"""

import struct

import pytest

from app.models.character import Character
from app.models.codex import CodexChunk, CodexNode
from app.models.location import Location
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.embeddings import pack, search, unpack
from app.services.codex.index import build_chunks, index_stats, pending_chunks
from app.services.codex.sync import sync_story


def _story(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    return story


def _prose(words: int, word: str = "lamp") -> str:
    return f"<p>{' '.join([word] * words)}</p>"


def _indexed(db, story, user):
    sync_story(story.id, db)
    return build_chunks(story.id, db)


def _chunks(db, story):
    return db.query(CodexChunk).filter(CodexChunk.story_id == story.id).all()


def test_scenes_and_characters_become_chunks(db_session, test_user):
    story = _story(db_session, test_user)
    db_session.add(
        Character(story_id=story.id, name="Elena", role="protagonist", personality="Stubborn. Afraid of the water.")
    )
    db_session.add(
        StructureNode(story_id=story.id, title="Arrival", level=0, level_type="scene", position=0, content=_prose(120))
    )
    db_session.commit()

    report = _indexed(db_session, story, test_user)
    kinds = {db_session.get(CodexNode, c.node_id).kind for c in _chunks(db_session, story)}
    assert kinds == {"scene", "character"}
    assert report.chunks == len(_chunks(db_session, story))


def test_a_node_with_no_prose_is_not_in_the_index(db_session, test_user):
    """An empty location stub has a name and nothing to retrieve."""
    story = _story(db_session, test_user)
    db_session.add(Location(story_id=story.id, name="Pier"))
    db_session.commit()
    _indexed(db_session, story, test_user)
    assert _chunks(db_session, story) == []


def test_rebuilding_keeps_the_vectors_of_text_that_did_not_change(db_session, test_user):
    story = _story(db_session, test_user)
    scene = StructureNode(
        story_id=story.id, title="Arrival", level=0, level_type="scene", position=0, content=_prose(120)
    )
    other = StructureNode(
        story_id=story.id, title="The Wreck", level=0, level_type="scene", position=1, content=_prose(120, "storm")
    )
    db_session.add_all([scene, other])
    db_session.commit()
    _indexed(db_session, story, test_user)

    for chunk in _chunks(db_session, story):
        chunk.embedding = pack([0.1, 0.2, 0.3])
        chunk.embed_model, chunk.dim = "test-embed", 3
    db_session.commit()

    scene.content = _prose(120, "beacon")
    db_session.commit()
    report = build_chunks(story.id, db_session)

    assert report.reused == 1  # the untouched scene
    by_node = {db_session.get(CodexNode, c.node_id).ref_id: c for c in _chunks(db_session, story)}
    assert by_node[scene.id].embedding is None  # the words changed; the vector no longer describes them
    assert by_node[other.id].embedding is not None


def test_deleted_prose_leaves_no_chunk_behind(db_session, test_user):
    story = _story(db_session, test_user)
    scene = StructureNode(
        story_id=story.id, title="Arrival", level=0, level_type="scene", position=0, content=_prose(120)
    )
    db_session.add(scene)
    db_session.commit()
    _indexed(db_session, story, test_user)
    assert _chunks(db_session, story)

    scene.content = ""
    db_session.commit()
    report = build_chunks(story.id, db_session)
    assert report.removed >= 1
    assert _chunks(db_session, story) == []


def test_a_story_with_no_graph_has_nothing_to_index(db_session, test_user):
    """Chunks hang off Codex nodes, so an unsynced story is empty, not broken."""
    story = _story(db_session, test_user)
    db_session.add(
        StructureNode(story_id=story.id, title="Arrival", level=0, level_type="scene", position=0, content=_prose(120))
    )
    db_session.commit()
    assert build_chunks(story.id, db_session).chunks == 0


def test_pending_is_anything_without_a_vector_from_this_model(db_session, test_user):
    story = _story(db_session, test_user)
    db_session.add(
        StructureNode(story_id=story.id, title="Arrival", level=0, level_type="scene", position=0, content=_prose(120))
    )
    db_session.commit()
    _indexed(db_session, story, test_user)

    assert len(pending_chunks(story.id, db_session, "test-embed")) == 1
    for chunk in _chunks(db_session, story):
        chunk.embedding, chunk.embed_model, chunk.dim = pack([1.0, 0.0]), "test-embed", 2
    db_session.commit()

    assert pending_chunks(story.id, db_session, "test-embed") == []
    # Changing the model invalidates every vector, because they are not comparable.
    assert len(pending_chunks(story.id, db_session, "other-embed")) == 1


def test_packing_a_vector_round_trips():
    vector = [0.5, -0.25, 0.125]
    assert unpack(pack(vector)) == pytest.approx(vector)
    assert len(pack(vector)) == 3 * struct.calcsize("f")


def _chunk(db, story, node, text, vector, model="test-embed", index=0):
    row = CodexChunk(
        story_id=story.id,
        node_id=node.id,
        chunk_index=index,
        text=text,
        token_count=len(text) // 4,
        embedding=pack(vector),
        embed_model=model,
        dim=len(vector),
    )
    db.add(row)
    db.commit()
    return row


def _two_scenes_with_vectors(db, user):
    story = _story(db, user)
    at_the_lighthouse = StructureNode(
        story_id=story.id, title="The Lamp Room", level=0, level_type="scene", position=0, content=_prose(120)
    )
    merely_mentioned = StructureNode(
        story_id=story.id, title="The Wreck", level=0, level_type="scene", position=1, content=_prose(120, "storm")
    )
    db.add_all([at_the_lighthouse, merely_mentioned])
    db.commit()
    sync_story(story.id, db)
    near = db.query(CodexNode).filter(CodexNode.ref_id == at_the_lighthouse.id).one()
    far = db.query(CodexNode).filter(CodexNode.ref_id == merely_mentioned.id).one()
    _chunk(db, story, near, "the lamp room", [1.0, 0.0, 0.0])
    _chunk(db, story, far, "the wreck", [0.0, 1.0, 0.0])
    return story, near, far


def test_search_ranks_by_closeness(db_session, test_user):
    story, near, far = _two_scenes_with_vectors(db_session, test_user)
    hits = search(db_session, story.id, [0.9, 0.1, 0.0], model="test-embed")
    assert [h.node_id for h in hits] == [near.id, far.id]
    assert hits[0].score > hits[1].score


def test_search_can_be_restricted_to_what_the_graph_turned_up(db_session, test_user):
    """Retrieval ranks what the graph already decided was relevant; it does not roam."""
    story, near, far = _two_scenes_with_vectors(db_session, test_user)
    hits = search(db_session, story.id, [0.0, 1.0, 0.0], node_ids=[near.id], model="test-embed")
    assert [h.node_id for h in hits] == [near.id]
    assert search(db_session, story.id, [1.0, 0.0, 0.0], node_ids=[], model="test-embed") == []


def test_search_ignores_vectors_from_another_model(db_session, test_user):
    story, near, _ = _two_scenes_with_vectors(db_session, test_user)
    assert search(db_session, story.id, [1.0, 0.0, 0.0], model="other-embed") == []


def test_stats_report_what_is_actually_indexed(db_session, test_user):
    story, _, _ = _two_scenes_with_vectors(db_session, test_user)
    stats = index_stats(story.id, db_session)
    assert (stats["chunks"], stats["embedded"], stats["pending"]) == (2, 2, 0)
    assert stats["models"] == ["test-embed"]
    assert stats["dim"] == 3
    assert stats["backend"] in ("sqlite-vec", "python")
