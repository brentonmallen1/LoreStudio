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
from app.services.character_knowledge import (
    NAMED,
    OMNISCIENT,
    POV,
    PROFILE_ONLY,
    SPEAKS,
    UNLIVED,
    build_scope,
    describe_scope,
)


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


def test_an_interview_outside_the_story_gets_no_scenes_at_all(db_session, test_user):
    """Profile-only is a deliberate choice, not "they happen to be in nothing"."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0, content="Elena arrives", summary="She reaches the island.")
    db_session.commit()

    scope = build_scope(elena, db_session, mode=PROFILE_ONLY)
    assert scope.scenes == [] and scope.facts == []

    block = describe_scope(elena, scope)
    assert "outside the story" in block
    assert "Arrival" not in block
    # It must not read as amnesia — the character exists, the plot is simply not the subject.
    assert "You have not appeared in any scene" not in block


def test_the_endpoint_can_ask_for_the_profile_only_scope(client, db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0, content="Elena arrives")
    db_session.commit()

    body = client.get(f"/api/characters/{elena.id}/knowledge?scope=profile").json()
    assert body["mode"] == "profile"
    assert body["scenes"] == []


def test_an_interview_records_which_scope_it_was_started_in(client, db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "Arrival", 0, content="Elena arrives")
    db_session.commit()

    pinned = client.post(
        f"/api/interviews/characters/{elena.id}",
        json={"knowledge_scope": "as_of", "context_node_id": scene.id},
    ).json()
    assert pinned["knowledge_scope"] == "as_of" and pinned["context_node_id"] == scene.id

    # Moving to another scope releases the pin, or the character would keep knowing a
    # point in the story the author has moved away from.
    freed = client.patch(f"/api/interviews/{pinned['id']}", json={"knowledge_scope": "profile"}).json()
    assert freed["knowledge_scope"] == "profile" and freed["context_node_id"] is None


def test_an_interview_defaults_to_the_profile_only_scope(client, db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    db_session.commit()
    body = client.post(f"/api/interviews/characters/{elena.id}", json={}).json()
    assert body["knowledge_scope"] == "profile"


def test_presence_mode_is_not_omniscience(db_session, test_user):
    """ "Knows the scenes they appear in" must mean exactly that, whole manuscript or not."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    hers = _scene(db_session, story, "The Lamp Room", 0, content="Elena climbs")
    _scene(db_session, story, "The Mainland", 1, content="The inspector files his report")
    db_session.commit()

    scope = build_scope(elena, db_session)
    assert [s.node_id for s in scope.scenes] == [hers.id]
    assert scope.scenes_considered == 2


def test_omniscient_shows_the_whole_manuscript_and_marks_what_they_did_not_live(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    hers = _scene(db_session, story, "The Lamp Room", 0, content="Elena climbs", summary="She climbs.")
    theirs = _scene(db_session, story, "The Mainland", 1, content="The inspector files", summary="He files.")
    db_session.commit()

    scope = build_scope(elena, db_session, mode=OMNISCIENT)
    by_id = {s.node_id: s for s in scope.scenes}
    assert set(by_id) == {hers.id, theirs.id}
    assert by_id[hers.id].reasons == (NAMED,)
    assert by_id[theirs.id].reasons == (UNLIVED,)


def test_the_omniscient_prompt_says_it_is_a_hypothetical(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "The Mainland", 0, content="The inspector files", summary="He files.")
    db_session.commit()

    block = describe_scope(elena, build_scope(elena, db_session, mode=OMNISCIENT))
    assert "This is a hypothetical" in block
    assert "I wasn't there, but if I had been" in block
    # It must not tell them they lived it, and must not license invention.
    assert "never invent events" in block.lower()


def test_omniscient_hands_over_what_the_reader_knows(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "The Mainland", 0, content="The inspector files")
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

    assert build_scope(elena, db_session).facts == []
    assert [f["subject"] for f in build_scope(elena, db_session, mode=OMNISCIENT).facts] == [
        "The logbook page is missing"
    ]


def test_an_interview_can_be_started_omniscient(client, db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    db_session.commit()
    body = client.post(f"/api/interviews/characters/{elena.id}", json={"knowledge_scope": "omniscient"}).json()
    assert body["knowledge_scope"] == "omniscient"


# ── Scoping v2: the same questions, answered from the graph (doc 07 §3) ──────────


def test_the_graph_answers_when_the_story_has_been_synced(db_session, test_user):
    from app.services.codex.sync import sync_story

    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "The Lamp Room", 0, content="Elena climbs", summary="She climbs.")
    _scene(db_session, story, "The Mainland", 1, content="The inspector files")
    db_session.commit()
    sync_story(story.id, db_session)

    scope = build_scope(elena, db_session)
    assert [s.title for s in scope.scenes] == ["The Lamp Room"]
    assert scope.scenes[0].summary == "She climbs."
    assert scope.scenes_considered == 2


def test_an_author_override_changes_what_the_interview_is_told(db_session, test_user):
    """The point of "who is here": a name in the prose can be someone being talked about."""
    from app.services.codex.presence import set_presence
    from app.services.codex.sync import sync_story

    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "The Mainland", 0, content="They spoke of Elena")
    db_session.commit()
    sync_story(story.id, db_session)
    assert len(build_scope(elena, db_session).scenes) == 1

    set_presence(scene.id, elena.id, "absent", db_session)
    sync_story(story.id, db_session)
    assert build_scope(elena, db_session).scenes == []


def test_the_graph_carries_facts_learned_offscreen(db_session, test_user):
    from app.services.codex.sync import sync_story

    story = _story(db_session, test_user)
    tomas = _character(db_session, story, "Tomas")
    scene = _scene(db_session, story, "The Reveal", 0, content="The lamp was out")
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

    scope = build_scope(tomas, db_session)
    assert [f["subject"] for f in scope.facts] == ["The light was out"]
    # He was not in the scene; he was told.
    assert scope.scenes == []


def test_an_unsynced_story_still_answers(db_session, test_user):
    """Nothing waits on a sync: with no graph, the scope is computed directly."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "The Lamp Room", 0, content="Elena climbs")
    db_session.commit()

    scope = build_scope(elena, db_session)
    assert [s.title for s in scope.scenes] == ["The Lamp Room"]
