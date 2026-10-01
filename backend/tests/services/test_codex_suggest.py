"""
The Codex's proposals: what one is worth before and after the author answers it.

The rule the whole design rests on — a suggestion counts for nothing until confirmed — is
tested in test_codex_context.py and test_character_knowledge.py. What is tested here is
what happens when the author *does* answer, in Proposals: a yes becomes a real authored
row, recorded so Undo takes it back and the proposal returns (doc 13 P4); a no is a
decline, kept with the others.
"""

from app.models.character import Character
from app.models.codex import CodexEdge, CodexNode
from app.models.location import ScenePresence
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.change_log import undo_latest
from app.services.codex.presence import derive_facts, derive_presence
from app.services.codex.sync import sync_story
from app.services.proposals import find, gather
from app.services.proposals.act import act, decline


def _story(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    elena = Character(story_id=story.id, name="Elena")
    db.add(elena)
    scene = StructureNode(
        story_id=story.id,
        title="The Lamp Room",
        level=0,
        level_type="scene",
        position=0,
        content="<p>The keeper set down the lamp and did not look back.</p>",
    )
    db.add(scene)
    db.commit()
    sync_story(story.id, db)
    return story, elena, scene


def _nodes(db, story):
    return {n.ref_id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story.id)}


def _propose_presence(db, story, elena, scene):
    nodes = _nodes(db, story)
    edge = CodexEdge(
        story_id=story.id,
        src_id=nodes[elena.id].id,
        dst_id=nodes[scene.id].id,
        kind="present_in",
        props={"basis": "inferred", "role": "participant", "quote": "The keeper set down the lamp"},
        source="llm",
        confidence=0.8,
    )
    db.add(edge)
    db.commit()
    return edge


def _propose_fact(db, story, scene, statement="The lamp has not been lit since the storm"):
    nodes = _nodes(db, story)
    fact = CodexNode(
        story_id=story.id,
        kind="fact",
        ref_id=f"llm:{scene.id}:0",
        label=statement,
        summary="did not look back",
        props={"quote": "did not look back", "confidence": 0.7},
        source="llm",
    )
    db.add(fact)
    db.flush()
    db.add(
        CodexEdge(
            story_id=story.id,
            src_id=fact.id,
            dst_id=nodes[scene.id].id,
            kind="established_in",
            source="llm",
            confidence=0.7,
        )
    )
    db.commit()
    return fact


def _yes(db, story, ref):
    act(story.id, find(story.id, db, f"codex:{ref}"), "confirm", db, story.user_id, None)


def _pending(db, story) -> set[str]:
    return {p.id for p in gather(story.id, db) if p.id.startswith("codex:")}


def test_confirming_presence_writes_the_authors_answer_not_a_blessed_guess(db_session, test_user):
    """It lands in scene_presence, where snapshots, exports and undo can reach it."""
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    assert _pending(db_session, story) == {f"codex:{edge.id}"}

    _yes(db_session, story, edge.id)
    row = db_session.query(ScenePresence).one()
    assert (row.node_id, row.character_id, row.role) == (scene.id, elena.id, "participant")
    # Answered: the proposal leaves the inbox.
    assert _pending(db_session, story) == set()


def test_undoing_a_yes_brings_the_proposal_back(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    fact = _propose_fact(db_session, story, scene)
    _yes(db_session, story, edge.id)
    _yes(db_session, story, fact.id)

    assert undo_latest(db_session, story.id, test_user.id, None) is not None
    assert undo_latest(db_session, story.id, test_user.id, None) is not None

    assert db_session.query(ScenePresence).count() == 0
    assert db_session.query(ReaderKnowledgeEvent).count() == 0
    assert _pending(db_session, story) == {f"codex:{edge.id}", f"codex:{fact.id}"}


def test_a_confirmed_presence_reaches_the_derived_graph_immediately(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    _yes(db_session, story, edge.id)

    authored = db_session.query(CodexEdge).filter(CodexEdge.kind == "present_in", CodexEdge.source == "author").all()
    assert len(authored) == 1
    assert authored[0].props == {"basis": "manual", "role": "participant"}


def test_confirming_a_fact_makes_it_a_reader_knowledge_event(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    fact = _propose_fact(db_session, story, scene)

    _yes(db_session, story, fact.id)
    event = db_session.query(ReaderKnowledgeEvent).one()
    assert event.subject == "The lamp has not been lit since the storm"
    assert event.node_id == scene.id
    # The authored fact is derived from the author's row; the proposal stays, answered.
    assert db_session.query(CodexNode).filter(CodexNode.kind == "fact", CodexNode.source == "author").count() == 1
    assert _pending(db_session, story) == set()


def test_a_confirmed_fact_is_known_by_whoever_was_in_the_scene(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    scene.pov_character_id = elena.id
    db_session.commit()
    sync_story(story.id, db_session)
    derive_presence(story.id, db_session)

    fact = _propose_fact(db_session, story, scene)
    _yes(db_session, story, fact.id)

    knows = db_session.query(CodexEdge).filter(CodexEdge.kind == "knows").all()
    assert len(knows) == 1
    assert db_session.get(CodexNode, knows[0].src_id).label == "Elena"


def test_a_no_is_remembered_and_writes_nothing(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    fact = _propose_fact(db_session, story, scene)

    for ref in (edge.id, fact.id):
        decline(story.id, find(story.id, db_session, f"codex:{ref}"), db_session, test_user.id, None)

    assert _pending(db_session, story) == set()
    assert db_session.query(ScenePresence).count() == 0
    assert db_session.query(ReaderKnowledgeEvent).count() == 0


def test_a_rebuild_does_not_empty_the_review_queue(db_session, test_user):
    """A sync used to delete every present_in edge, proposals included."""
    story, elena, scene = _story(db_session, test_user)
    _propose_presence(db_session, story, elena, scene)
    _propose_fact(db_session, story, scene)

    sync_story(story.id, db_session)
    derive_presence(story.id, db_session)
    derive_facts(story.id, db_session)

    assert db_session.query(CodexEdge).filter(CodexEdge.source == "llm").count() == 2
    assert db_session.query(CodexNode).filter(CodexNode.source == "llm").count() == 1


def test_an_empty_object_is_not_a_valid_answer():
    """
    The response model is the grammar Ollama decodes against. With both lists defaulted,
    `{}` was valid, and gemma4 took it for a whole scene — reporting success having read
    nothing. Required keys make "found nothing" an explicit pair of empty lists.
    """
    import pytest
    from pydantic import ValidationError

    from app.services.codex.suggest import SuggestionResponse

    assert SuggestionResponse.model_json_schema()["required"] == ["present", "establishes"]
    with pytest.raises(ValidationError):
        SuggestionResponse.model_validate({})
    assert SuggestionResponse.model_validate({"present": [], "establishes": []}).present == []


def test_a_proposal_can_upgrade_a_character_the_prose_only_names(db_session, test_user):
    """
    Name matching marks Elena "mentioned". The model reads the scene and proposes she was
    actually there. With one edge per pair the proposal collided with the derived edge
    and failed the whole suggestion job; now the two claims sit side by side until the
    author answers, and confirming it makes her a participant.
    """
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.flush()
    elena = Character(story_id=story.id, name="Elena Marsh")
    db_session.add(elena)
    scene = StructureNode(
        story_id=story.id,
        title="The Lamp Room",
        level=0,
        level_type="scene",
        position=0,
        content="<p>Elena set down the lamp and did not look back.</p>",
    )
    db_session.add(scene)
    db_session.commit()
    sync_story(story.id, db_session)

    derived = db_session.query(CodexEdge).filter(CodexEdge.kind == "present_in", CodexEdge.source == "derived").one()
    assert derived.props["role"] == "mentioned"

    proposal = _propose_presence(db_session, story, elena, scene)  # would raise IntegrityError before
    _yes(db_session, story, proposal.id)

    row = db_session.query(ScenePresence).filter(ScenePresence.character_id == elena.id).one()
    assert row.role == "participant"
    assert _pending(db_session, story) == set()
