"""
The Outline's Not placed yet tray (doc 29 D3): ideas are jotted, renamed, reordered and
deleted, and a placed idea becomes a planned scene at its spot and leaves the tray, as one
change that one Undo takes back.
"""

from app.models.note import Note
from app.models.outline import Outline, OutlineItem
from app.models.structure import StructureNode
from app.models.user import User
from app.services.tray import idea_to_scene

H = {"X-Client-Id": "tab-1"}


def _story(client):
    return client.post("/api/stories", json={"title": "Salt"}).json()["id"]


def _jot(client, sid, text, **extra):
    r = client.post(f"/api/stories/{sid}/tray", json={"text": text, **extra}, headers=H)
    assert r.status_code == 201, r.text
    return r.json()


def _tray(client, sid):
    return [i["text"] for i in client.get(f"/api/stories/{sid}/tray").json()]


def test_a_short_idea_is_the_title_and_a_long_one_keeps_its_words_as_what_happens():
    assert idea_to_scene("  Calder lies   about her name ") == ("Calder lies about her name", "")
    long = "The Tremor — Elena notices her left hand is worse. She does not withdraw from the audition."
    assert idea_to_scene(long) == ("The Tremor", long)
    title, what = idea_to_scene("A second storm comes in and it is worse than the first one, far worse, in act three")
    assert title.endswith("…") and len(title) <= 61
    assert what.startswith("A second storm")


def test_ideas_are_jotted_in_order_renamed_reordered_and_deleted(client, db_session):
    sid = _story(client)
    assert client.get(f"/api/stories/{sid}/tray").json() == []
    a = _jot(client, sid, "Calder lies about her name")
    b = _jot(client, sid, "A second storm, worse")
    c = _jot(client, sid, "Margaret knew all along", position=0)
    assert _tray(client, sid) == ["Margaret knew all along", "Calder lies about her name", "A second storm, worse"]
    # The tray is one row per story, made with its first idea.
    assert db_session.query(Outline).filter_by(story_id=sid).count() == 1

    assert client.patch(f"/api/tray-items/{a['id']}", json={"text": "Calder lies"}, headers=H).status_code == 200
    r = client.post(f"/api/stories/{sid}/tray/reorder", json={"item_ids": [b["id"], a["id"], c["id"]]}, headers=H)
    assert r.status_code == 204
    assert _tray(client, sid) == ["A second storm, worse", "Calder lies", "Margaret knew all along"]
    client.post(f"/api/stories/{sid}/undo", headers=H)
    assert _tray(client, sid) == ["Margaret knew all along", "Calder lies", "A second storm, worse"]

    assert client.delete(f"/api/tray-items/{c['id']}", headers=H).status_code == 204
    assert _tray(client, sid) == ["Calder lies", "A second storm, worse"]


def test_an_empty_idea_is_refused(client):
    sid = _story(client)
    assert client.post(f"/api/stories/{sid}/tray", json={"text": ""}).status_code == 422


def test_several_ideas_at_once_undo_together(client):
    sid = _story(client)
    r = client.post(
        f"/api/stories/{sid}/tray/many", json={"items": [{"text": "One"}, {"text": "Two", "notes": "why"}]}, headers=H
    )
    assert r.status_code == 201 and [i["text"] for i in r.json()] == ["One", "Two"]
    client.post(f"/api/stories/{sid}/undo", headers=H)
    assert _tray(client, sid) == []


def test_another_writers_tray_is_out_of_reach(client, db_session):
    sid = _story(client)
    idea = _jot(client, sid, "Mine")
    db_session.add(User(id="stranger", username="stranger", password_hash="x", display_name="S", settings={}))
    db_session.flush()
    db_session.query(OutlineItem).filter_by(id=idea["id"]).one().outline.story.user_id = "stranger"
    db_session.commit()
    assert client.get(f"/api/stories/{sid}/tray").status_code == 404
    assert client.delete(f"/api/tray-items/{idea['id']}").status_code == 404


def test_a_placed_idea_becomes_a_planned_scene_at_its_spot_and_one_undo_puts_it_back(client, db_session):
    sid = _story(client)
    chapter = client.post(
        f"/api/stories/{sid}/structure", json={"title": "Old Records", "level": 0, "level_type": "chapter"}
    ).json()["id"]
    first, second = (
        client.post(
            f"/api/stories/{sid}/structure",
            json={"title": t, "level": 1, "level_type": "scene", "parent_id": chapter, "position": i},
        ).json()["id"]
        for i, t in enumerate(["The Logbook", "Low Water"])
    )
    long = "The Gap — six months of entries are missing, and the Visitor is not surprised at all."
    idea = _jot(client, sid, long, notes="Under “Cracks in the Record”")

    r = client.post(
        f"/api/tray-items/{idea['id']}/place",
        json={"parent_id": chapter, "position": 1, "level": 1, "level_type": "scene"},
        headers=H,
    )
    assert r.status_code == 201, r.text
    node = r.json()
    assert (node["title"], node["synopsis"], node["status"]) == ("The Gap", long, "planned")
    db_session.expire_all()
    order = [n.title for n in db_session.query(StructureNode).filter_by(parent_id=chapter).order_by("position")]
    assert order == ["The Logbook", "The Gap", "Low Water"]
    assert db_session.query(Note).filter_by(node_id=node["id"]).one().content == "Under “Cracks in the Record”"
    assert _tray(client, sid) == []

    assert client.post(f"/api/stories/{sid}/undo", headers=H).status_code == 200
    db_session.expire_all()
    assert db_session.get(StructureNode, node["id"]) is None
    assert [n.id for n in db_session.query(StructureNode).filter_by(parent_id=chapter).order_by("position")] == [
        first,
        second,
    ]
    assert db_session.query(Note).count() == 0
    assert _tray(client, sid) == [long]


def test_placing_into_a_part_of_another_story_is_refused(client):
    sid, other = _story(client), _story(client)
    elsewhere = client.post(f"/api/stories/{other}/structure", json={"title": "C", "level": 0}).json()["id"]
    idea = _jot(client, sid, "Calder lies")
    r = client.post(f"/api/tray-items/{idea['id']}/place", json={"parent_id": elsewhere, "position": 0})
    assert r.status_code == 404
