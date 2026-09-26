"""
Dialogue rows are derived from the prose, and every reader brings them up to date first.

The Dialogue view of "Sixty Minutes" was empty: the seed writes scene prose directly, and
rows were only extracted when the editor saved a scene. So were rows after a rename, quote
normalisation or find-and-replace. And a save deleted every row and rebuilt it, taking the
author's subtext notes with it.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.dialogue import DialogueBlock
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.dialogue_service import sync_scene_dialogue, sync_story_dialogue


def _world(db: Session, user_id: str, content: str, *, first_person: bool = False) -> tuple[Story, StructureNode]:
    story = Story(id=str(uuid.uuid4()), user_id=user_id, title="Sixty Minutes")
    maya = Character(id=str(uuid.uuid4()), story_id=story.id, name="Maya Chen")
    victor = Character(id=str(uuid.uuid4()), story_id=story.id, name="Victor Harlan")
    db.add_all([story, maya, victor])
    db.commit()
    if first_person:
        story.narrative_perspective = "first_person"
        story.pov_character_id = maya.id
    node = StructureNode(
        id=str(uuid.uuid4()),
        story_id=story.id,
        title="The Slip",
        level=0,
        level_type="scene",
        position=0,
        content=content,
    )
    db.add(node)
    db.commit()
    return story, node


def _lines(db: Session, node: StructureNode) -> list[tuple[str, str, str]]:
    return [(b.content, b.speaker_name, b.attribution_method) for b in sync_scene_dialogue(node, db)]


def test_scene_whose_prose_was_never_extracted_shows_its_dialogue(client: TestClient, db_session: Session, test_user):
    # Written the way the seed writes it: straight into the column, no save through the editor.
    _, node = _world(
        db_session,
        test_user.id,
        '<p>"It\'s a different kind of data relationship."&lt;Victor Harlan&gt;</p><p>"What\'s the contrast?"</p>',
        first_person=True,
    )
    assert db_session.query(DialogueBlock).count() == 0

    blocks = client.get(f"/api/scenes/{node.id}/dialogue").json()

    assert [(b["content"], b["speaker_name"], b["attribution_method"]) for b in blocks] == [
        ("It's a different kind of data relationship.", "Victor Harlan", "explicit"),
        ("What's the contrast?", "Maya Chen", "pov_default"),
    ]


def test_story_wide_readers_bring_every_scene_up_to_date(client: TestClient, db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>"We ran several pilots that year."&lt;Victor Harlan&gt;</p>')
    victor = db_session.query(Character).filter(Character.name == "Victor Harlan").one()

    lines = client.get(f"/api/characters/{victor.id}/dialogue").json()

    assert [line["content"] for line in lines] == ["We ran several pilots that year."]


def test_a_subtext_note_survives_the_scene_being_edited(db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>"I came here hoping I was wrong."</p>')
    (row,) = sync_scene_dialogue(node, db_session)
    row.subtext = "She hoped she was right."
    db_session.commit()

    node.content = '<p>The Visitor set down her tea.</p><p>"I came here hoping I was wrong."</p>'
    db_session.commit()
    (after,) = sync_scene_dialogue(node, db_session)

    assert (after.id, after.subtext, after.paragraph_index) == (row.id, "She hoped she was right.", 1)


def test_a_hand_correction_keeps_its_speaker_and_goes_when_its_line_does(db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>"You knew," Eleanor said. "You came here knowing this."</p>')
    rows = sync_scene_dialogue(node, db_session)
    rows[1].speaker_name, rows[1].attribution_method = "Maya Chen", "manual"
    db_session.commit()

    assert _lines(db_session, node)[1] == ("You came here knowing this.", "Maya Chen", "manual")

    node.content = '<p>"You knew," Eleanor said.</p>'
    db_session.commit()
    assert _lines(db_session, node) == [("You knew,", "", "unattributed")]


def test_nothing_is_written_when_the_rows_already_match(db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>"Yes."&lt;Maya Chen&gt;</p><p>"Yes."&lt;Victor Harlan&gt;</p>')
    first = {b.id: b.updated_at for b in sync_scene_dialogue(node, db_session)}
    db_session.expire_all()

    again = {b.id: b.updated_at for b in sync_scene_dialogue(node, db_session)}

    assert again == first and len(again) == 2  # a repeated line keeps one row per occurrence


def test_a_mention_by_first_name_is_the_character_it_names(db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>@Victor sets his glass down. "Just industry standard."</p>')

    (row,) = sync_scene_dialogue(node, db_session)

    victor = db_session.query(Character).filter(Character.name == "Victor Harlan").one()
    assert (row.speaker_name, row.character_id, row.attribution_method) == ("Victor Harlan", victor.id, "inferred")


def test_a_first_name_two_characters_share_names_nobody(db_session: Session, test_user):
    story, node = _world(db_session, test_user.id, '<p>@Victor waits. "Go on."</p>')
    db_session.add(Character(id=str(uuid.uuid4()), story_id=story.id, name="Victor Ames"))
    db_session.commit()

    (row,) = sync_scene_dialogue(node, db_session)

    assert (row.speaker_name, row.character_id) == ("Victor", None)


def test_an_untagged_reply_alternates_to_the_other_speaker(db_session: Session, test_user):
    _, node = _world(
        db_session,
        test_user.id,
        '<p>"You ran a pilot in 2019."&lt;Maya Chen&gt;</p>'
        '<p>"We ran several pilots that year."&lt;Victor Harlan&gt;</p>'
        '<p>"This one used data from a children\'s platform."</p>',
    )

    assert _lines(db_session, node)[-1][1:] == ("Maya Chen", "alternating")


def test_alternation_counts_a_first_name_and_a_full_name_as_one_speaker(db_session: Session, test_user):
    # Were "@Victor" and "<Victor Harlan>" two people, the untagged reply would go to Victor.
    _, node = _world(
        db_session,
        test_user.id,
        '<p>"Tell me about 2019."&lt;Maya Chen&gt;</p>'
        '<p>"We ran several pilots."&lt;Victor Harlan&gt;</p>'
        '<p>@Victor shrugs. "Nothing unusual."</p>'
        '<p>"Like the Telemetry pilot wasn\'t."</p>',
    )

    assert _lines(db_session, node)[-1] == ("Like the Telemetry pilot wasn't.", "Maya Chen", "alternating")


def test_emptying_a_scene_clears_its_dialogue(client: TestClient, db_session: Session, test_user):
    _, node = _world(db_session, test_user.id, '<p>"Go on."&lt;Maya Chen&gt;</p>')
    sync_story_dialogue(node.story_id, db_session)

    client.patch(f"/api/structure/{node.id}", json={"content": ""})

    assert client.get(f"/api/scenes/{node.id}/dialogue").json() == []
