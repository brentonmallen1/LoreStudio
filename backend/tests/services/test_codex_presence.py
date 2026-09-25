"""
Presence and knowledge in the graph (refactor doc 07 §3) — the layers interviews read.

The efficacy check the doc asks for is here: a fact revealed in one scene to two of three
characters must produce `knows` edges for exactly those two.
"""

from app.models.character import Character
from app.models.codex import CodexEdge, CodexNode
from app.models.dialogue import DialogueBlock
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.presence import set_presence
from app.services.codex.sync import sync_story


def _story(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    return story


def _scene(db, story, title, position, **kw):
    node = StructureNode(story_id=story.id, title=title, level=0, level_type="scene", position=position, **kw)
    db.add(node)
    db.flush()
    return node


def _character(db, story, name):
    c = Character(story_id=story.id, name=name)
    db.add(c)
    db.flush()
    return c


def _node(db, ref_id):
    return db.query(CodexNode).filter(CodexNode.ref_id == ref_id).one()


def _presence(db, character, scene):
    return (
        db.query(CodexEdge)
        .filter(
            CodexEdge.kind == "present_in",
            CodexEdge.src_id == _node(db, character.id).id,
            CodexEdge.dst_id == _node(db, scene.id).id,
        )
        .one_or_none()
    )


def test_the_strongest_signal_decides_how_present_someone_is(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    pov = _scene(db_session, story, "The Lamp Room", 0, pov_character_id=elena.id, content="<p>She climbed.</p>")
    spoken = _scene(db_session, story, "Knock at the Door", 1, content="<p>Someone knocked.</p>")
    named = _scene(db_session, story, "The Mainland", 2, content="<p>They spoke of Elena.</p>")
    db_session.add(DialogueBlock(scene_id=spoken.id, character_id=elena.id, content="Who's there?"))
    db_session.commit()

    sync_story(story.id, db_session)
    assert _presence(db_session, elena, pov).props["role"] == "pov"
    assert _presence(db_session, elena, spoken).props["role"] == "participant"
    # Named in the prose is the weakest signal, and says so.
    mentioned = _presence(db_session, elena, named)
    assert mentioned.props == {"basis": "mention", "role": "mentioned"}
    assert mentioned.confidence < 1.0


def test_the_author_can_say_who_is_really_there(db_session, test_user):
    """A name in the prose can be someone being talked about; the author settles it."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "The Mainland", 0, content="<p>They spoke of Elena.</p>")
    db_session.commit()
    sync_story(story.id, db_session)

    set_presence(scene.id, elena.id, "absent", db_session)
    sync_story(story.id, db_session)

    edge = _presence(db_session, elena, scene)
    assert edge.props == {"basis": "manual", "role": "absent"}
    assert edge.source == "author"


def test_only_the_characters_who_were_there_know_what_happened(db_session, test_user):
    """Doc 07 §7: revealed to two of three, and the third must not have the edge."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    mara = _character(db_session, story, "Mara")
    _character(db_session, story, "Tomas")
    scene = _scene(db_session, story, "The Reveal", 0, pov_character_id=elena.id, content="<p>The lamp was out.</p>")
    db_session.add(DialogueBlock(scene_id=scene.id, character_id=mara.id, content="It was never lit."))
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id, node_id=scene.id, knowledge_type="truth_revealed", subject="The light was out"
        )
    )
    db_session.commit()

    sync_story(story.id, db_session)
    fact = db_session.query(CodexNode).filter(CodexNode.kind == "fact").one()
    knowers = {
        db_session.get(CodexNode, e.src_id).label
        for e in db_session.query(CodexEdge).filter(CodexEdge.kind == "knows", CodexEdge.dst_id == fact.id)
    }
    assert knowers == {"Elena", "Mara"}
    assert "Tomas" not in knowers


def test_being_mentioned_in_a_scene_is_not_learning_what_happened_there(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "The Reveal", 0, content="<p>They agreed not to tell Elena.</p>")
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id, node_id=scene.id, knowledge_type="truth_revealed", subject="The light was out"
        )
    )
    db_session.commit()

    sync_story(story.id, db_session)
    assert db_session.query(CodexEdge).filter(CodexEdge.kind == "knows").count() == 0
    assert _presence(db_session, elena, scene).props["role"] == "mentioned"


def test_a_character_the_author_listed_knows_it_wherever_they_were(db_session, test_user):
    """Told offscreen is a real thing, and the author's list is the record of it."""
    story = _story(db_session, test_user)
    tomas = _character(db_session, story, "Tomas")
    scene = _scene(db_session, story, "The Reveal", 0, content="<p>The lamp was out.</p>")
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id,
            node_id=scene.id,
            knowledge_type="truth_revealed",
            subject="The light was out",
            characters_who_know=[tomas.id],
        )
    )
    db_session.commit()

    sync_story(story.id, db_session)
    assert db_session.query(CodexEdge).filter(CodexEdge.kind == "knows").count() == 1


def test_facts_track_their_scene_and_disappear_with_it(db_session, test_user):
    story = _story(db_session, test_user)
    scene = _scene(db_session, story, "The Reveal", 0)
    event = ReaderKnowledgeEvent(
        story_id=story.id, node_id=scene.id, knowledge_type="truth_revealed", subject="The light was out"
    )
    db_session.add(event)
    db_session.commit()

    sync_story(story.id, db_session)
    assert db_session.query(CodexEdge).filter(CodexEdge.kind == "established_in").count() == 1

    db_session.delete(event)
    db_session.commit()
    sync_story(story.id, db_session)
    assert db_session.query(CodexNode).filter(CodexNode.kind == "fact").count() == 0


def test_a_character_is_found_by_the_name_the_prose_uses(db_session, test_user):
    """
    A label is how the Lorebook files someone, not how a sentence says them. Matching the
    whole label found almost nobody: Eleanor Vance was absent from her own opening scene
    because the prose calls her Eleanor.
    """
    story = _story(db_session, test_user)
    eleanor = _character(db_session, story, "Eleanor Vance")
    calder = _character(db_session, story, "The Visitor (Calder)")
    scene = _scene(
        db_session, story, "The Light", 0, content="<p>Eleanor noted it in the log.</p><p>Calder did not answer.</p>"
    )
    sync_story(story.id, db_session)

    assert _presence(db_session, eleanor, scene).props["basis"] == "mention"
    assert _presence(db_session, calder, scene).props["basis"] == "mention"


def test_a_name_is_not_found_inside_another_word_or_in_lowercase(db_session, test_user):
    story = _story(db_session, test_user)
    tom = _character(db_session, story, "Tom Reyes")
    will = _character(db_session, story, "Will Turner")
    scene = _scene(db_session, story, "Morning", 0, content="<p>Tomorrow she will go to the atom lab.</p>")
    sync_story(story.id, db_session)

    assert _presence(db_session, tom, scene) is None
    assert _presence(db_session, will, scene) is None


def test_a_first_name_two_characters_share_is_evidence_for_neither(db_session, test_user):
    story = _story(db_session, test_user)
    thomas_v = _character(db_session, story, "Thomas Vance")
    thomas_h = _character(db_session, story, "Thomas Holt")
    scene = _scene(db_session, story, "The Quay", 0, content="<p>Thomas waited on the quay.</p>")
    sync_story(story.id, db_session)

    assert _presence(db_session, thomas_v, scene) is None
    assert _presence(db_session, thomas_h, scene) is None


def test_name_forms_never_treat_an_article_as_a_name():
    from app.services.codex.presence import name_forms

    assert name_forms("Eleanor Vance") == {"Eleanor Vance", "Eleanor"}
    assert name_forms("The Visitor (Calder)") == {"The Visitor (Calder)", "The Visitor", "Calder"}
    assert "The" not in name_forms("The Visitor (Calder)")


def test_an_unconfirmed_proposal_does_not_teach_anyone_anything(db_session, test_user):
    """
    The suggestion pass proposes "Tomas was here" as an unconfirmed `llm` edge. Deriving
    who knows what read every presence edge, so the proposal alone handed Tomas the fact —
    before the author had said yes to him being in the room.
    """
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    tomas = _character(db_session, story, "Tomas")
    scene = _scene(db_session, story, "The Reveal", 0, pov_character_id=elena.id, content="<p>The lamp was out.</p>")
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id, node_id=scene.id, knowledge_type="truth_revealed", subject="The light was out"
        )
    )
    db_session.commit()
    sync_story(story.id, db_session)

    db_session.add(
        CodexEdge(
            story_id=story.id,
            src_id=_node(db_session, tomas.id).id,
            dst_id=_node(db_session, scene.id).id,
            kind="present_in",
            source="llm",
            props={"role": "participant", "basis": "inferred"},
        )
    )
    db_session.commit()
    sync_story(story.id, db_session)

    fact = db_session.query(CodexNode).filter(CodexNode.kind == "fact").one()
    knowers = {
        db_session.get(CodexNode, e.src_id).label
        for e in db_session.query(CodexEdge).filter(CodexEdge.kind == "knows", CodexEdge.dst_id == fact.id)
    }
    assert knowers == {"Elena"}
