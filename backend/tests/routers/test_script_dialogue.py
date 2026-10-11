"""
Who speaks in a screenplay (doc 25, P4): the cues say, not quote marks.

A cue's dialogue is its character's line, the parenthetical before it is the line's direction,
and V.O. or O.S. says how it is heard. The rows are the ones prose makes, so presence, the
Dialogue tool and the numbers read a script as they read prose, and a subtext note stays with
its line.
"""

import pytest

from app.models import Character
from app.models.codex import CodexEdge
from app.models.dialogue import DialogueBlock
from app.models.structure import StoryStructureTemplate
from app.services.codex.presence import derive_presence
from app.services.codex.sync import sync_story
from app.services.seed import STRUCTURE_TEMPLATES

SCENE = (
    '<p data-el="heading">INT. KEEPER\'S COTTAGE - NIGHT</p>'
    '<p data-el="action">ELEANOR waits. A knock.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="paren">(quietly)</p><p data-el="dialogue">Don\'t open the door.</p>'
    '<p data-el="cue">THE VISITOR (O.S.)</p><p data-el="dialogue">Mrs. Vance?</p>'
    '<p data-el="cue">ELEANOR (V.O.)</p><p data-el="dialogue">The glass never lies.</p>'
    '<p data-el="paren">(beat)</p><p data-el="dialogue">People do.</p>'
    '<p data-el="cue">HARBOURMASTER</p><p data-el="dialogue">Storm\'s coming.</p>'
    '<p data-el="action">"Not a line," says the sign.</p>'
)


@pytest.fixture
def script(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    for name in ("Eleanor Vance", "The Visitor (Calder)"):
        db_session.add(Character(story_id=story["id"], name=name))
    db_session.commit()
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": SCENE})
    return story


def _lines(client, node_id):
    return client.get(f"/api/scenes/{node_id}/dialogue").json()


def test_each_cue_speaks_its_dialogue(client, script):
    got = [
        (b["speaker_name"], b["content"], b["direction"], b["dialogue_type"])
        for b in _lines(client, script["start_node_id"])
    ]
    assert got == [
        ("Eleanor Vance", "Don't open the door.", "quietly", "speech"),
        ("The Visitor (Calder)", "Mrs. Vance?", "", "off_screen"),
        ("Eleanor Vance", "The glass never lies.", "", "voice_over"),
        ("Eleanor Vance", "People do.", "beat", "voice_over"),
        ("Harbourmaster", "Storm's coming.", "", "speech"),
    ]
    lines = _lines(client, script["start_node_id"])
    assert all(b["attribution_method"] == "cue" and b["confidence"] == 1.0 for b in lines)
    assert lines[-1]["character_id"] is None  # not in the Lorebook: an unknown speaker


def test_an_unknown_cue_is_a_finding(client, script):
    feed = client.get(f"/api/stories/{script['id']}/findings").json()["findings"]
    unknown = [f for f in feed if f["check"] == "unknown_speaker"]
    assert [f["text"] for f in unknown] == ["“Harbourmaster” speaks here but is not in the Lorebook"]


def test_a_subtext_note_stays_when_the_line_moves(client, db_session, script):
    node_id = script["start_node_id"]
    row = db_session.query(DialogueBlock).filter_by(scene_id=node_id, content="People do.").one()
    row.subtext = "She means herself."
    db_session.commit()
    client.patch(f"/api/structure/{node_id}", json={"content": '<p data-el="action">Later.</p>' + SCENE})
    db_session.expire_all()
    assert db_session.get(DialogueBlock, row.id).subtext == "She means herself."


def test_a_cue_puts_its_character_in_the_scene(client, db_session, script):
    sync_story(script["id"], db_session)
    derive_presence(script["id"], db_session)
    edges = db_session.query(CodexEdge).filter_by(story_id=script["id"], kind="present_in").all()
    participants = {e.src_id for e in edges if e.props["role"] == "participant"}
    assert len(participants) == 2  # Eleanor and the Visitor speak; nobody else is in the Lorebook


def test_adding_an_unknown_speaker_to_the_lorebook(client, db_session, script):
    feed = client.get(f"/api/stories/{script['id']}/findings").json()["findings"]
    [unknown] = [f for f in feed if f["check"] == "unknown_speaker"]
    assert unknown["fix"] == {**unknown["fix"], "kind": "add", "old": "Harbourmaster"}
    assert client.post(f"/api/stories/{script['id']}/findings/{unknown['id']}/fix").status_code == 200
    added = db_session.query(Character).filter_by(story_id=script["id"], name="Harbourmaster").one()
    line = [b for b in _lines(client, script["start_node_id"]) if b["content"] == "Storm's coming."][0]
    assert line["character_id"] == added.id
    feed = client.get(f"/api/stories/{script['id']}/findings").json()["findings"]
    assert not [f for f in feed if f["check"] == "unknown_speaker"]
    client.post(f"/api/stories/{script['id']}/undo")
    db_session.expire_all()
    assert db_session.query(Character).filter_by(story_id=script["id"], name="Harbourmaster").count() == 0
