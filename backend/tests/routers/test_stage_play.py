"""
A stage play (doc 25, P9): a third format, the same elements laid out for the theatre: names
centred over full-width speeches, stage directions in italics from halfway across, each act on a
new page, its length in pages, and the AI talking about the stage rather than the camera.
"""

import pytest

from app.models import Story
from app.models.structure import StoryStructureTemplate
from app.schemas.story import TitlePage
from app.services.llm.features import fits
from app.services.llm.gateway import ai_gateway
from app.services.llm.prompts.core import SCRIPT_MARKER, STAGE_MARKER
from app.services.script_export import Block, ScriptDoc, ScriptOptions
from app.services.script_pdf import CHAR_PT, LEFT_PT, layout
from app.services.script_syntax import scene_blocks, scene_lines
from app.services.seed import STRUCTURE_TEMPLATES
from app.services.word_count import length_status

SCENE = (
    '<p data-el="heading">SCENE 1</p>'
    '<p data-el="action">The keeper\'s cottage. Night.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Don\'t open the door.</p>'
)


@pytest.fixture
def play(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    r = client.post(
        "/api/stories", json={"title": "Light", "story_format": "stage_play", "structure_template_id": "stage-play"}
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_a_play_is_counted_on_a_plays_page(client, play):
    node = client.patch(f"/api/structure/{play['start_node_id']}", json={"content": SCENE}).json()
    assert node["line_count"] == scene_lines(scene_blocks(SCENE), "stage_play")
    status = length_status("stage_play", "one_act", 30)
    assert (status["unit"], status["max"]) == ("pages", 60)


def test_a_plays_page_is_laid_out_for_the_theatre():
    blocks = [
        ("heading", "SCENE 1"),
        ("action", "The keeper's cottage. Night."),
        ("cue", "ELEANOR"),
        ("dialogue", "Don't open the door."),
        ("heading", "ACT TWO"),
        ("heading", "SCENE 1"),
        ("action", "Dawn."),
    ]
    doc = ScriptDoc("Light", "", TitlePage(), [Block(e, t) for e, t in blocks], format="stage_play")
    pages = layout(doc, ScriptOptions(title_page=False)).pages
    first = {i.text: i for i in pages[0]}
    assert first["ELEANOR"].left == LEFT_PT + 26 * CHAR_PT  # centred over the speech
    assert first["Don't open the door."].left == LEFT_PT  # the full width
    direction = first["The keeper's cottage. Night."]
    assert (direction.left, direction.kind) == (LEFT_PT + 20 * CHAR_PT, "italic")
    assert len(pages) == 2 and "ACT TWO" in {i.text for i in pages[1]}  # a new act, a new page


def test_the_ai_talks_about_the_stage(db_session, play):
    story = db_session.get(Story, play["id"])
    assert not fits("dialogue-attribution", story) and fits("pacing-analysis", story)

    class User:
        id = "u1"
        settings: dict = {}

    composed = ai_gateway.compose_prompt(
        "Read the screenplay for unfilmables: what a camera could not film.",
        User(),
        True,
        "show-dont-tell",
        script="stage_play",
    )
    assert STAGE_MARKER in composed and SCRIPT_MARKER not in composed
    assert "stage play for unstageables: what an audience could not see on stage" in composed


def test_the_dashboard_counts_a_play_in_pages(client, play):
    client.patch(f"/api/stories/{play['id']}", json={"intended_length": "one_act"})
    client.patch(f"/api/structure/{play['start_node_id']}", json={"content": SCENE})
    [row] = [r for r in client.get("/api/stories/progress").json() if r["story_id"] == play["id"]]
    assert (row["target_unit"], row["target_current"], row["target_words"]) == ("pages", 1, 60)
