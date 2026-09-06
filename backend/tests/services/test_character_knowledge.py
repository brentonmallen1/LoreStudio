"""
Character knowledge scoping v1 (refactor doc 06 §6).

An interview used to receive a journey summary built from every scene that named the
character, with nothing to say where their knowledge ended — so the persona would discuss
scenes it was never in, and events after the point the author was asking about.
"""

from app.models.character import Character
from app.models.dialogue import DialogueBlock
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.character_knowledge import NAMED, POV, SPEAKS, build_scope, describe_scope


def _story(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    return story


def _scene(db, story, title, position, content="", summary="", pov=None):
    node = StructureNode(
        story_id=story.id,
        title=title,
        level=0,
        level_type="scene",
        position=position,
        content=content,
        content_summary=summary,
        pov_character_id=pov.id if pov else None,
    )
    db.add(node)
    db.flush()
    return node


def _character(db, story, name):
    c = Character(story_id=story.id, name=name)
    db.add(c)
    db.flush()
    return c


def test_presence_is_the_union_of_pov_dialogue_and_name(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0, content="<p>The keeper waited.</p>")
    pov_scene = _scene(db_session, story, "The Lamp Room", 1, pov=elena)
    spoken = _scene(db_session, story, "Knock at the Door", 2)
    named = _scene(db_session, story, "Storm", 3, content="<p>Elena climbed the stairs.</p>")
    db_session.add(DialogueBlock(scene_id=spoken.id, character_id=elena.id, content="Who's there?"))
    db_session.commit()

    scope = build_scope(elena, db_session)
    by_id = {s.node_id: s for s in scope.scenes}
    assert set(by_id) == {pov_scene.id, spoken.id, named.id}
    assert by_id[pov_scene.id].reasons == (POV,)
    assert by_id[spoken.id].reasons == (SPEAKS,)
    assert by_id[named.id].reasons == (NAMED,)
    assert scope.scenes_considered == 4


def test_as_of_stops_the_scope_at_that_scene(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    first = _scene(db_session, story, "Arrival", 0, content="Elena arrives")
    middle = _scene(db_session, story, "The Lamp Room", 1, content="Elena climbs")
    _scene(db_session, story, "The Wreck", 2, content="Elena finds the wreck")
    db_session.commit()

    scope = build_scope(elena, db_session, as_of_node_id=middle.id)
    assert [s.node_id for s in scope.scenes] == [first.id, middle.id]
    assert scope.as_of_title == "The Lamp Room"


def test_a_character_knows_facts_they_are_listed_on(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "Arrival", 0, content="Elena arrives")
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id,
            node_id=scene.id,
            knowledge_type="truth_revealed",
            subject="The light was out that night",
            characters_who_know=[elena.id],
        )
    )
    # A clue planted for the reader in a scene she is in — hers to find, not hers to know.
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=story.id,
            node_id=scene.id,
            knowledge_type="clue_planted",
            subject="The logbook page is missing",
            characters_who_know=[],
        )
    )
    db_session.commit()

    scope = build_scope(elena, db_session)
    assert [f["subject"] for f in scope.facts] == ["The light was out that night"]


def test_the_prompt_block_names_the_limit(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0, content="Elena arrives", summary="She reaches the island.")
    cutoff = _scene(db_session, story, "The Lamp Room", 1, content="Elena climbs")
    db_session.commit()

    block = describe_scope(elena, build_scope(elena, db_session, cutoff.id))
    assert "Arrival" in block and "She reaches the island." in block
    assert "You do not know anything outside these scenes" in block
    assert "nothing that happens after The Lamp Room" in block
    assert "say you were not there or do not know" in block


def test_a_character_in_no_scenes_is_told_so(db_session, test_user):
    story = _story(db_session, test_user)
    ghost = _character(db_session, story, "Nobody")
    _scene(db_session, story, "Arrival", 0, content="Elena arrives")
    db_session.commit()

    block = describe_scope(ghost, build_scope(ghost, db_session))
    assert "You have not appeared in any scene" in block


def test_the_endpoint_returns_what_the_prompt_is_given(client, db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "Arrival", 0, content="Elena arrives", summary="She reaches the island.")
    db_session.commit()

    body = client.get(f"/api/characters/{elena.id}/knowledge?as_of={scene.id}").json()
    assert body["as_of_title"] == "Arrival"
    assert body["scenes"][0]["title"] == "Arrival"
    assert body["scenes"][0]["reasons"] == [NAMED]
    assert body["scenes_considered"] == 1
