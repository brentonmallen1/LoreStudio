"""
The context assembler (doc 07 §5).

The property this file exists to protect: what the transparency view shows the author is
computed from the packet the model receives, in the same call. Two implementations of one
answer drift, and the one the author reads is the one that is not sent.
"""

from app.models.character import Character
from app.models.codex import CodexChunk, CodexEdge, CodexNode
from app.models.location import Location, SceneSetting
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.context import (
    DEFAULT_EDGE_KINDS,
    ContextOptions,
    assemble_scene,
    edge_kinds_for,
    retrieve_with_vector,
    walk,
)
from app.services.codex.embeddings import pack
from app.services.codex.sync import sync_story


def _story(db, user, **kw):
    story = Story(title="Lighthouse", user_id=user.id, **kw)
    db.add(story)
    db.flush()
    return story


def _scene(db, story, title, position=0, **kw):
    node = StructureNode(story_id=story.id, title=title, level=0, level_type="scene", position=position, **kw)
    db.add(node)
    db.flush()
    return node


def _blocks(assembled) -> dict[str, bool]:
    return {b.key: b.included for b in assembled.blocks}


def test_the_account_matches_the_packet(db_session, test_user):
    story = _story(db_session, test_user, logline="A keeper goes missing.")
    elena = Character(story_id=story.id, name="Elena", role="protagonist", personality="Stubborn.")
    db_session.add(elena)
    scene = _scene(db_session, story, "Arrival", content="<p>@Elena climbed the stair.</p>", synopsis="She arrives.")
    db_session.commit()

    assembled = assemble_scene(story, scene, db_session)
    blocks = _blocks(assembled)
    assert blocks["scene.synopsis"] is True
    assert blocks["scene.purpose"] is False  # no purpose was written
    assert blocks["characters_in_scene"] is True
    assert len(assembled.packet["characters_in_scene"]) == 1
    assert assembled.tokens > 0


def test_a_section_that_was_switched_off_cannot_be_reported_as_included(db_session, test_user):
    """The old preview listed sources separately and would have said "included" anyway."""
    story = _story(db_session, test_user)
    db_session.add(Character(story_id=story.id, name="Elena", personality="Stubborn."))
    scene = _scene(db_session, story, "Arrival", content="<p>@Elena climbed the stair.</p>")
    db_session.commit()

    off = assemble_scene(story, scene, db_session, ContextOptions(include_characters=False))
    assert off.packet["characters_in_scene"] == []
    assert _blocks(off)["characters_in_scene"] is False


def test_a_story_level_request_has_no_scene_blocks(db_session, test_user):
    story = _story(db_session, test_user)
    db_session.commit()
    assembled = assemble_scene(story, None, db_session)
    assert assembled.packet["scene"] is None
    assert not any(b.key.startswith("scene.") for b in assembled.blocks)


def _graph_story(db, user):
    story = _story(db, user)
    elena = Character(story_id=story.id, name="Elena")
    db.add(elena)
    db.flush()
    lighthouse = Location(story_id=story.id, name="The Lighthouse")
    db.add(lighthouse)
    db.flush()
    here = _scene(db, story, "The Lamp Room", 0, pov_character_id=elena.id)
    elsewhere = _scene(db, story, "The Mainland", 1)
    db.add(SceneSetting(node_id=here.id, location_id=lighthouse.id, role="primary"))
    db.commit()
    sync_story(story.id, db)
    from app.services.codex.presence import derive_presence

    derive_presence(story.id, db)
    return story, elena, lighthouse, here, elsewhere


def test_a_walk_says_why_it_reached_each_node(db_session, test_user):
    story, elena, lighthouse, here, elsewhere = _graph_story(db_session, test_user)
    reached = walk(db_session, story.id, [here.id], kinds=("present_in", "at"))

    labels = {n.id: n.label for n in db_session.query(CodexNode).filter(CodexNode.story_id == story.id)}
    by_label = {labels[node_id]: why for node_id, why in reached.items()}
    assert by_label["The Lamp Room"] == "you are here"
    assert by_label["Elena"] == "present in The Lamp Room"
    assert by_label["The Lighthouse"] == "set in The Lamp Room"
    assert "The Mainland" not in by_label  # nothing connects it


def test_a_walk_ignores_an_unconfirmed_proposal(db_session, test_user):
    """A suggestion is a question for the author; it may not quietly widen the context."""
    story, elena, _, here, elsewhere = _graph_story(db_session, test_user)
    char_node = db_session.query(CodexNode).filter(CodexNode.ref_id == elena.id).one()
    far_node = db_session.query(CodexNode).filter(CodexNode.ref_id == elsewhere.id).one()
    proposal = CodexEdge(story_id=story.id, src_id=char_node.id, dst_id=far_node.id, kind="present_in", source="llm")
    db_session.add(proposal)
    db_session.commit()

    # One hop from Elena: the scene she is really in, and — if the proposal counted —
    # the one a model guessed she was in.
    assert far_node.id not in walk(db_session, story.id, [elena.id], kinds=("present_in",))

    from datetime import UTC, datetime

    proposal.confirmed_at = datetime.now(UTC)
    db_session.commit()
    assert far_node.id in walk(db_session, story.id, [elena.id], kinds=("present_in",))


def test_features_walk_the_edges_their_question_needs():
    assert "knows" in edge_kinds_for("interview")
    assert "knows" not in edge_kinds_for("scene-chat")
    assert edge_kinds_for("not-a-feature") == DEFAULT_EDGE_KINDS


def _chunk(db, story, node, text, vector):
    db.add(
        CodexChunk(
            story_id=story.id,
            node_id=node.id,
            chunk_index=0,
            text=text,
            token_count=len(text) // 4,
            embedding=pack(vector),
            embed_model="test-embed",
            dim=len(vector),
        )
    )
    db.commit()


def test_retrieval_stays_inside_what_the_graph_reached(db_session, test_user):
    story, _, lighthouse, here, elsewhere = _graph_story(db_session, test_user)
    near_node = db_session.query(CodexNode).filter(CodexNode.ref_id == lighthouse.id).one()
    far_node = db_session.query(CodexNode).filter(CodexNode.ref_id == elsewhere.id).one()
    _chunk(db_session, story, near_node, "the lamp room", [1.0, 0.0])
    _chunk(db_session, story, far_node, "the mainland", [1.0, 0.0])

    blocks = retrieve_with_vector(
        db_session, story.id, [1.0, 0.0], seed_ref_ids=[here.id], kinds=("present_in", "at"), model="test-embed"
    )
    assert [b.node_id for b in blocks] == [near_node.id]
    assert blocks[0].why == "set in The Lamp Room"
    assert blocks[0].label == "The Lighthouse"
    assert blocks[0].score == 1.0


def test_open_story_chat_may_search_the_whole_story(db_session, test_user):
    story, _, lighthouse, here, elsewhere = _graph_story(db_session, test_user)
    far_node = db_session.query(CodexNode).filter(CodexNode.ref_id == elsewhere.id).one()
    _chunk(db_session, story, far_node, "the mainland", [1.0, 0.0])

    unreached = retrieve_with_vector(
        db_session, story.id, [1.0, 0.0], seed_ref_ids=[here.id], kinds=("at",), model="test-embed"
    )
    assert unreached == []

    everywhere = retrieve_with_vector(
        db_session,
        story.id,
        [1.0, 0.0],
        seed_ref_ids=[here.id],
        kinds=("at",),
        model="test-embed",
        whole_story=True,
    )
    assert [b.node_id for b in everywhere] == [far_node.id]
    assert everywhere[0].why == "found by meaning"


def test_an_exact_restriction_does_not_walk(db_session, test_user):
    """
    An interview's scope is a bound, not a starting point.

    Walking from it would reach the scene next door; the character was kept out of that
    one on purpose, and retrieval must not put them back in it.
    """
    story, elena, lighthouse, here, elsewhere = _graph_story(db_session, test_user)
    nodes = {n.ref_id: n for n in db_session.query(CodexNode).filter(CodexNode.story_id == story.id)}
    for ref in (here.id, elsewhere.id):
        _chunk(db_session, story, nodes[ref], "prose", [1.0, 0.0])

    allowed = retrieve_with_vector(
        db_session,
        story.id,
        [1.0, 0.0],
        seed_ref_ids=[],
        restrict_ref_ids=[here.id],
        model="test-embed",
        why="you were there",
    )
    assert [b.node_id for b in allowed] == [nodes[here.id].id]
    assert allowed[0].why == "you were there"

    assert (
        retrieve_with_vector(db_session, story.id, [1.0, 0.0], seed_ref_ids=[], restrict_ref_ids=[], model="test-embed")
        == []
    )
