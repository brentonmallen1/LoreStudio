"""
The review queue: what a proposal is worth before and after the author answers it.

The rule the whole design rests on — a suggestion counts for nothing until confirmed — is
tested in test_codex_context.py and test_character_knowledge.py. What is tested here is
what happens when the author *does* answer: a confirmed proposal becomes a real authored
row, and the graph stops being the only place it lives.
"""

from app.models.character import Character
from app.models.codex import CodexEdge, CodexNode
from app.models.location import ScenePresence
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.presence import derive_facts, derive_presence
from app.services.codex.suggest import review
from app.services.codex.sync import sync_story


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


def test_confirming_presence_writes_the_authors_answer_not_a_blessed_guess(db_session, test_user):
    """It lands in scene_presence, where snapshots, exports and undo can reach it."""
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)

    assert review(story.id, db_session, [edge.id], accept=True) == {"reviewed": 1}
    row = db_session.query(ScenePresence).one()
    assert (row.node_id, row.character_id, row.role) == (scene.id, elena.id, "participant")
    # The proposal is gone: the answer is authored data now, not a suggestion.
    assert db_session.query(CodexEdge).filter(CodexEdge.source == "llm").count() == 0


def test_a_confirmed_presence_reaches_the_derived_graph_immediately(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    review(story.id, db_session, [edge.id], accept=True)

    present = db_session.query(CodexEdge).filter(CodexEdge.kind == "present_in").all()
    assert len(present) == 1
    assert present[0].props == {"basis": "manual", "role": "participant"}
    assert present[0].source == "author"


def test_confirming_a_fact_makes_it_a_reader_knowledge_event(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    fact = _propose_fact(db_session, story, scene)

    review(story.id, db_session, [fact.id], accept=True)
    event = db_session.query(ReaderKnowledgeEvent).one()
    assert event.subject == "The lamp has not been lit since the storm"
    assert event.node_id == scene.id
    # The llm node is gone; the fact that replaced it is derived from the author's row.
    assert db_session.query(CodexNode).filter(CodexNode.source == "llm").count() == 0
    assert db_session.query(CodexNode).filter(CodexNode.kind == "fact").one().source == "author"


def test_a_confirmed_fact_is_known_by_whoever_was_in_the_scene(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    scene.pov_character_id = elena.id
    db_session.commit()
    sync_story(story.id, db_session)
    derive_presence(story.id, db_session)

    fact = _propose_fact(db_session, story, scene)
    review(story.id, db_session, [fact.id], accept=True)

    knows = db_session.query(CodexEdge).filter(CodexEdge.kind == "knows").all()
    assert len(knows) == 1
    assert db_session.get(CodexNode, knows[0].src_id).label == "Elena"


def test_rejecting_leaves_nothing_behind(db_session, test_user):
    story, elena, scene = _story(db_session, test_user)
    edge = _propose_presence(db_session, story, elena, scene)
    fact = _propose_fact(db_session, story, scene)

    assert review(story.id, db_session, [edge.id, fact.id], accept=False) == {"reviewed": 2}
    assert db_session.query(CodexEdge).filter(CodexEdge.source == "llm").count() == 0
    assert db_session.query(CodexNode).filter(CodexNode.source == "llm").count() == 0
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
