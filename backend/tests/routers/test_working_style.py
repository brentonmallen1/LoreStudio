"""
How the writer likes to work (doc 29 D1): New Story asks once and the story keeps it.

"plan", "discover" or "both"; a story made before the question was asked keeps "", so its
Overview is the one it had. Changing it on Story identity is an edit like any other: undoable.
"""

from app.models import Story
from tests.fixtures.series_factory import make_book


def test_a_new_story_keeps_how_its_writer_likes_to_work(client):
    body = client.post("/api/stories", json={"title": "Salt", "working_style": "plan"}).json()
    assert body["working_style"] == "plan"
    assert client.get(f"/api/stories/{body['id']}").json()["working_style"] == "plan"


def test_a_story_made_without_the_question_has_no_style(client):
    body = client.post("/api/stories", json={"title": "Old habits"}).json()
    assert body["working_style"] == ""


def test_only_the_three_ways_are_kept(client):
    r = client.post("/api/stories", json={"title": "Odd", "working_style": "improvise"})
    assert r.status_code == 422


def test_changing_the_style_can_be_undone(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "working_style": "discover", "scaffold": False}).json()
    r = client.patch(f"/api/stories/{story['id']}", json={"working_style": "both"})
    assert r.status_code == 200 and r.json()["working_style"] == "both"
    assert r.headers.get("X-Change-Batch")

    undone = client.post(f"/api/stories/{story['id']}/undo")
    assert undone.status_code == 200, undone.text
    db_session.expire_all()
    assert db_session.get(Story, story["id"]).working_style == "discover"


def test_a_sequel_is_worked_on_as_the_book_before_it_unless_asked(client, db_session, test_user):
    one = make_book(db_session, test_user)
    one.story.working_style = "plan"
    db_session.commit()
    same = client.post(f"/api/stories/{one.story.id}/sequel", json={"title": "Part Two", "carry": []})
    assert same.status_code == 201, same.text
    assert same.json()["working_style"] == "plan"
    other = client.post(
        f"/api/stories/{one.story.id}/sequel",
        json={"title": "Part Three", "carry": [], "working_style": "discover"},
    )
    assert other.json()["working_style"] == "discover"
