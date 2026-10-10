"""
A story is written as prose or as a screenplay (doc 25 P0).

The format is chosen with the story and can be changed later; the screenplay structures say
which format they were written for, so the New Story dialog can offer the right ones.
"""

import pytest

from app.models import Story
from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.seed import STRUCTURE_TEMPLATES
from app.services.story_format import is_script
from tests.fixtures.series_factory import make_book


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def test_a_story_is_prose_unless_it_says_otherwise(client):
    body = client.post("/api/stories", json={"title": "Salt"}).json()
    assert body["story_format"] == "prose"


def test_a_screenplay_starts_with_its_acts_and_a_first_scene(client, db_session):
    body = client.post(
        "/api/stories",
        json={"title": "The Light", "story_format": "screenplay", "structure_template_id": "screenplay"},
    ).json()
    assert body["story_format"] == "screenplay"
    nodes = {n.id: n for n in db_session.query(StructureNode).filter(StructureNode.story_id == body["id"])}
    tops = sorted((n for n in nodes.values() if n.parent_id is None), key=lambda n: n.position)
    assert [n.title for n in tops] == ["Act One", "Act Two", "Act Three"]
    start = nodes[body["start_node_id"]]
    assert (start.level_type, start.title, start.parent_id) == ("scene", "Scene 1", tops[0].id)


def test_sequences_sit_between_acts_and_scenes(client, db_session):
    body = client.post(
        "/api/stories",
        json={"title": "Feature", "story_format": "screenplay", "structure_template_id": "screenplay-sequences"},
    ).json()
    start = db_session.get(StructureNode, body["start_node_id"])
    sequence = db_session.get(StructureNode, start.parent_id)
    assert (sequence.level_type, sequence.title) == ("sequence", "Sequence 1")


def test_an_unknown_format_is_refused(client):
    r = client.post("/api/stories", json={"title": "Odd", "story_format": "opera"})
    assert r.status_code == 422


def test_changing_the_format_can_be_undone(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "scaffold": False}).json()
    r = client.patch(f"/api/stories/{story['id']}", json={"story_format": "screenplay"})
    assert r.status_code == 200 and r.json()["story_format"] == "screenplay"
    assert r.headers.get("X-Change-Batch")

    undone = client.post(f"/api/stories/{story['id']}/undo")
    assert undone.status_code == 200, undone.text
    db_session.expire_all()
    assert db_session.get(Story, story["id"]).story_format == "prose"


def test_templates_say_which_format_they_were_written_for(client):
    by_id = {t["id"]: t for t in client.get("/api/templates/structures").json()}
    assert by_id["screenplay"]["format"] == "screenplay"
    assert by_id["screenplay-sequences"]["format"] == "screenplay"
    assert by_id["three-act"]["format"] == "" and by_id["freeform"]["format"] == ""


def test_a_sequel_is_written_in_the_same_format(client, db_session, test_user):
    one = make_book(db_session, test_user)
    one.story.story_format = "screenplay"
    db_session.commit()
    r = client.post(f"/api/stories/{one.story.id}/sequel", json={"title": "Part Two", "carry": []})
    assert r.status_code == 201, r.text
    assert db_session.get(Story, r.json()["id"]).story_format == "screenplay"


def test_is_script():
    assert not is_script(None)
    assert not is_script(Story(title="t", story_format="prose"))
    assert is_script(Story(title="t", story_format="screenplay"))


SCENE = (
    '<p data-el="heading">INT. LIGHTHOUSE - NIGHT</p><p>Eleanor climbs.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="dialogue">It is still burning.</p>'
)


def test_a_script_scene_keeps_its_length_in_lines(client):
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    r = client.patch(f"/api/structure/{story['start_node_id']}", json={"content": SCENE})
    assert r.status_code == 200, r.text
    # heading, blank, action, blank, cue, dialogue
    assert r.json()["line_count"] == 6


def test_prose_has_no_lines_and_a_recount_finds_them(client, db_session):
    from app.services.word_count import recount_story

    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    r = client.patch(f"/api/structure/{story['start_node_id']}", json={"content": SCENE})
    assert r.json()["line_count"] == 0

    db_session.get(Story, story["id"]).story_format = "screenplay"
    recount_story(story["id"], db_session)
    assert db_session.get(StructureNode, story["start_node_id"]).line_count == 6
