"""The tutorial stories (doc 26, P6): both, once per account, and a fresh copy on request."""

import re
from pathlib import Path

from app.models import Character, Location, Story
from app.models.structure import StructureNode
from app.services import tutorial

HELPERS = Path(__file__).resolve().parents[3] / "frontend/src/lib/typing/helpers.ts"
SHORTCUTS = Path(__file__).resolve().parents[3] / "frontend/src/lib/keyboard/shortcuts.ts"


def _lessons(db, story_id):
    return [
        n
        for n in db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position)
        if n.level_type == "scene"
    ]


def test_the_first_sign_in_makes_both_stories_once(client, db_session, test_user):
    made = client.post("/api/system/tutorial").json()["made"]
    assert made == [tutorial.PROSE, tutorial.SCRIPT]
    assert client.post("/api/system/tutorial").json()["made"] == []
    db_session.refresh(test_user)
    kept = test_user.settings["tutorial"]
    stories = {s.id: s for s in db_session.query(Story).filter(Story.user_id == test_user.id)}
    assert stories[kept["prose"]].story_format == "prose"
    assert stories[kept["screenplay"]].story_format == "screenplay"


def test_a_deleted_tutorial_is_not_brought_back_unasked(client, db_session, test_user):
    client.post("/api/system/tutorial")
    db_session.refresh(test_user)
    client.delete(f"/api/stories/{test_user.settings['tutorial']['prose']}")
    assert client.post("/api/system/tutorial").json()["made"] == []
    again = client.post("/api/system/tutorial/restart", json={"kind": "prose"}).json()
    assert again["title"] == tutorial.PROSE
    db_session.refresh(test_user)
    assert test_user.settings["tutorial"]["prose"] == again["story_id"]


def test_each_lesson_has_its_card_and_a_cast_to_name(db_session, test_user):
    for kind in tutorial.KINDS:
        story = tutorial.make(db_session, test_user, kind)
        lessons = _lessons(db_session, story.id)
        assert lessons
        numbers = sorted(n.metadata_["lesson"]["number"] for n in lessons)
        assert numbers == list(range(1, len(lessons) + 1))
        assert all(n.metadata_["lesson"]["of"] == len(lessons) for n in lessons)
        assert db_session.query(Character).filter(Character.story_id == story.id).count() == len(tutorial.CAST)
        assert db_session.query(Location).filter(Location.story_id == story.id).count() == len(tutorial.PLACES)


def test_a_script_lesson_opens_on_its_heading(db_session, test_user):
    story = tutorial.make(db_session, test_user, "screenplay")
    first = _lessons(db_session, story.id)[0]
    assert first.content.startswith('<p data-el="heading">INT.')
    assert first.interior == "INT"


def test_lessons_name_helpers_and_keys_the_app_has():
    helpers = set(re.findall(r'^    id: "([a-z-]+)"', HELPERS.read_text(), re.M))
    keys = set(re.findall(r"^  ([a-zA-Z]+): \{", SHORTCUTS.read_text(), re.M))
    for _, scenes in tutorial.PROSE_LESSONS + tutorial.SCRIPT_LESSONS:
        for title, lesson, _ in scenes:
            assert {p["id"] for p in lesson["practice"]} <= helpers, title
            for p in lesson["practice"]:
                assert set(re.findall(r"\{\{key:(\w+)\}\}", p["task"])) <= keys, title
            assert set(re.findall(r"\{\{key:(\w+)\}\}", lesson["text"])) <= keys, title


def test_only_the_assistant_lesson_speaks_of_ai():
    """Every other lesson works in Writer mode, which shows no AI. The Assistant's lesson shows
    there too and says it needs Studio mode (Brenton, 2026-10-13)."""
    topic, [(_, assistant, _)] = tutorial.PROSE_LESSONS[-1]
    assert topic == "The Assistant"
    assert "needs Studio mode" in assistant["text"]
    for topic, scenes in tutorial.PROSE_LESSONS[:-1] + tutorial.SCRIPT_LESSONS:
        for title, lesson, content in scenes:
            words = " ".join([title, lesson["text"], content, *(p["task"] for p in lesson["practice"])])
            assert not re.search(r"\b(AI|Assistant|model|LLM)\b", words), title


def test_an_account_with_stories_of_its_own_is_not_handed_the_tutorial(client, db_session, test_user):
    """Signing in after an update: someone already writing gets no lessons unasked."""
    db_session.add(Story(user_id=test_user.id, title="My novel", story_format="prose"))
    db_session.commit()
    assert client.post("/api/system/tutorial").json()["made"] == []
    db_session.refresh(test_user)
    assert test_user.settings["tutorial"] == {}
    assert client.post("/api/system/tutorial/restart", json={"kind": "screenplay"}).status_code == 200
