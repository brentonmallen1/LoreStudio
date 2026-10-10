"""
A script's local checks read its action lines (doc 25, P5): the habits that matter in action,
held to the present tense; said-bookisms, sentence variety and point of view stand aside, and
a character's words are theirs to say however they say them.
"""

import pytest

from app.models.structure import StoryStructureTemplate
from app.services.seed import STRUCTURE_TEMPLATES

SCENE = (
    '<p data-el="heading">INT. LAMP ROOM - NIGHT</p>'
    '<p data-el="action">Eleanor climbed the stair. The lamp is lit by her.</p>'
    '<p data-el="cue">ELEANOR</p>'
    '<p data-el="dialogue">I closed the door. It was opened by someone, she hissed at me.</p>'
    '<p data-el="action">She turns to the window.</p>'
)


@pytest.fixture
def script(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": SCENE})
    return story


def _findings(client, story):
    r = client.post(f"/api/stories/{story['id']}/findings/run-local")
    assert r.status_code == 200, r.text
    return {f["check"]: f for f in r.json()["findings"]}


def test_action_is_held_to_the_present_tense(client, script):
    found = _findings(client, script)
    past = found["past_in_action"]
    assert past["passages"] == ["Eleanor climbed the stair."]
    assert "tense_shift" not in found and "pov_drift" not in found


def test_only_the_action_is_read_for_habits(client, script):
    found = _findings(client, script)
    habits = ("passive_voice", "adverb_overuse", "repeated_words", "past_in_action")
    passages = [p for k, f in found.items() if k in habits for p in f.get("passages") or []]
    # The dialogue's past tense, passive and "hissed" are the character's own.
    assert not any("closed the door" in p or "opened by someone" in p for p in passages)
    assert "said_bookisms" not in found and "sentence_variety" not in found
