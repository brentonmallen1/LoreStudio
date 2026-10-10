"""
A story's intended length, by format (doc 25, P5): words for prose, pages for a script, and a
script's pages are the ones its PDF prints.
"""

import pytest

from app.models.structure import StoryStructureTemplate
from app.services.numbers import form_for
from app.services.seed import STRUCTURE_TEMPLATES
from app.services.word_count import length_status


@pytest.mark.parametrize(
    ("fmt", "form", "current", "level"),
    [
        ("screenplay", "feature", 100, "normal"),
        ("screenplay", "feature", 112, "approaching"),
        ("screenplay", "feature", 125, "exceeded"),
        ("screenplay", "tv_half_hour", 30, "normal"),
        ("prose", "novel", 90_000, "approaching"),
    ],
)
def test_where_a_length_stands(fmt, form, current, level):
    status = length_status(fmt, form, current)
    assert status["warning_level"] == level
    assert status["unit"] == ("pages" if fmt == "screenplay" else "words")


def test_a_form_the_format_does_not_have_sets_no_target():
    assert length_status("screenplay", "novel", 100) is None
    assert length_status("prose", "feature", 100) is None


def test_what_a_length_reads_as_in_each_format():
    # A script's forms overlap (30 pages is a short film or a half-hour): length names none.
    assert form_for(30, "screenplay") is None
    assert form_for(5_000) == "short_story"


def test_a_scripts_overview_counts_the_pages_it_prints(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    client.patch(f"/api/stories/{story['id']}", json={"intended_length": "short_film"})
    speech = '<p data-el="cue">ELEANOR</p><p data-el="dialogue">' + "Keep the lamp lit. " * 120 + "</p>"
    client.patch(
        f"/api/structure/{story['start_node_id']}",
        json={"content": '<p data-el="heading">INT. LAMP ROOM - NIGHT</p>' + speech * 3},
    )
    pages = client.get(f"/api/stories/{story['id']}/script-layout", params={"title_page": False}).json()["page_count"]
    target = client.get(f"/api/stories/{story['id']}/overview").json()["word_count_target"]
    assert pages > 1
    assert (target["current"], target["unit"], target["max"]) == (pages, "pages", 40)


def test_a_scripts_numbers_are_in_pages(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    client.patch(f"/api/stories/{story['id']}", json={"intended_length": "short_film"})
    long_scene = (
        '<p data-el="heading">INT. LAMP ROOM - NIGHT</p>'
        + '<p data-el="action">The lamp turns and the light goes out over the water again. </p>' * 60
        + '<p data-el="cue">ELEANOR</p><p data-el="dialogue">'
        + "Keep it lit. " * 200
        + "</p>"
    )
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": long_scene})
    got = client.get(f"/api/stories/{story['id']}/numbers").json()["pages"]
    layout = client.get(f"/api/stories/{story['id']}/script-layout", params={"title_page": False}).json()
    assert got["total"] == layout["page_count"] and got["target"]["unit"] == "pages"
    assert [s["id"] for s in got["long_scenes"]] == [story["start_node_id"]]
    assert 0 < got["dialogue_pct"] < 100
    assert got["by_part"][0]["title"] == "Act One" and got["by_part"][0]["pages"] > 3

    prose = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    assert client.get(f"/api/stories/{prose['id']}/numbers").json()["pages"] is None
