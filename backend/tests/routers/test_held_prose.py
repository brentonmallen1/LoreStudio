"""Prose held outside any scene (an older import's chapters): flagged as a finding, and given a
scene of its own from the finding or the chapter's page, as one change ⌘Z takes back."""

import pytest

from app.models import Note, Story
from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.manuscript_builder import get_manuscript_sections
from app.services.seed import STRUCTURE_TEMPLATES


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _story(db_session, test_user):
    """Act › Chapter holding prose, with a scene after it; and an act holding prose of its own."""
    story = Story(user_id=test_user.id, title="Keeper", structure_template_id="three-act")
    db_session.add(story)
    db_session.flush()
    add = lambda **kw: db_session.add(StructureNode(story_id=story.id, status="draft", **kw))  # noqa: E731
    add(id="a1", level=0, level_type="act", title="Opening Image", position=0, content="<p>Fire.</p>", word_count=1)
    add(id="a2", level=0, level_type="act", title="The Crime", position=1)
    add(
        id="c1",
        parent_id="a2",
        level=1,
        level_type="chapter",
        title="Lay of the Land",
        position=0,
        content='<p>Pre-dawn <span data-note-id="n1">farm</span>.</p>',
        word_count=2,
    )
    add(
        id="s1",
        parent_id="c1",
        level=2,
        level_type="scene",
        title="Later",
        position=0,
        content="<p>Later.</p>",
        word_count=1,
    )
    db_session.add(Note(id="n1", story_id=story.id, kind="note", node_id="c1", anchor="farm", content="Goats."))
    db_session.commit()
    return story


def _held(client, story):
    feed = client.get(f"/api/stories/{story.id}/findings").json()
    return [f for f in feed["findings"] if f["check"] == "held_prose"]


def test_a_chapter_holding_prose_gets_a_scene_and_undo_puts_it_back(client, db_session, test_user):
    story = _story(db_session, test_user)
    r = client.post("/api/structure/c1/give-scene", json={})
    assert r.status_code == 201, r.text
    scene = r.json()
    assert (scene["title"], scene["level"], scene["parent_id"], scene["position"]) == ("Lay of the Land", 2, "c1", 0)
    db_session.expire_all()
    c1 = db_session.get(StructureNode, "c1")
    assert (c1.content, c1.word_count) == ("", 0)
    assert db_session.get(StructureNode, scene["id"]).word_count == 2
    assert db_session.get(StructureNode, "s1").position == 1
    assert db_session.get(Note, "n1").node_id == scene["id"]

    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200
    db_session.expire_all()
    c1 = db_session.get(StructureNode, "c1")
    assert c1.word_count == 2 and "Pre-dawn" in c1.content
    assert db_session.get(StructureNode, scene["id"]) is None
    assert db_session.get(StructureNode, "s1").position == 0
    assert db_session.get(Note, "n1").node_id == "c1"


def test_an_act_holding_prose_gets_a_chapter_and_a_scene(client, db_session, test_user):
    _story(db_session, test_user)
    scene = client.post("/api/structure/a1/give-scene", json={}).json()
    chapter = db_session.get(StructureNode, scene["parent_id"])
    assert (chapter.level, chapter.parent_id, chapter.title) == (1, "a1", "Opening Image")


def test_a_node_without_prose_of_its_own_is_refused(client, db_session, test_user):
    _story(db_session, test_user)
    assert client.post("/api/structure/a2/give-scene", json={}).status_code == 400
    assert client.post("/api/structure/s1/give-scene", json={}).status_code == 400


def test_the_finding_fixes_every_holder_in_one_change(client, db_session, test_user):
    story = _story(db_session, test_user)
    [found] = _held(client, story)
    assert found["fix"]["kind"] == "scenes" and "2" in found["text"]
    r = client.post(f"/api/stories/{story.id}/findings/{found['id']}/fix")
    assert r.status_code == 200, r.text
    assert _held(client, story) == []
    prose = " ".join(s.content or "" for s in get_manuscript_sections(story, db_session))
    assert "Pre-dawn" in prose and "Fire." in prose

    client.post(f"/api/stories/{story.id}/undo")
    db_session.expire_all()
    assert db_session.get(StructureNode, "a1").word_count == 1 and db_session.get(StructureNode, "c1").word_count == 2


def test_the_finding_names_the_level_when_they_are_all_one(client, db_session, test_user):
    story = _story(db_session, test_user)
    client.post("/api/structure/a1/give-scene", json={})
    [found] = _held(client, story)
    assert found["text"].startswith("1 chapter holds 2 words")


def test_a_story_whose_prose_is_all_in_scenes_has_no_finding(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": "<p>Words here.</p>"})
    assert _held(client, db_session.get(Story, story["id"])) == []
