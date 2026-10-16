"""Scene takes (doc 29 D7): try another version, switch, choose the one that counts, rename and
delete, each undoable; the take that counts is the scene's prose for exports and counts; and
snapshots, deletes and their undo carry the takes."""

from app.models import SceneTake, StructureNode
from app.services import snapshot_service as svc
from tests.fixtures.findings_story import build_findings_story

FIRST = "<p>The knock came twice. She opened the door on a woman in a waxed coat.</p>"
SECOND = "<p>The knock came twice. “You’ll be the keeper,” the woman said.</p>"


def _scene(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    scene = nodes["Arrival"]
    scene.content, scene.word_count = FIRST, 14
    db_session.commit()
    return story, scene


def _undo(client, story):
    r = client.post(f"/api/stories/{story.id}/undo")
    assert r.status_code == 200, r.text
    return r.json()


def _redo(client, story):
    r = client.post(f"/api/stories/{story.id}/redo")
    assert r.status_code == 200, r.text


def _takes(client, scene):
    r = client.get(f"/api/structure/{scene.id}/takes")
    assert r.status_code == 200, r.text
    return r.json()["takes"]


def _shape(takes):
    """(number, label, counts, open) for each take."""
    return [(t["number"], t["label"], t["counts"], t["is_open"]) for t in takes]


def _try(client, scene):
    r = client.post(f"/api/structure/{scene.id}/takes")
    assert r.status_code == 201, r.text
    return r.json()["takes"]


def _write(client, take_id, content, words):
    r = client.put(f"/api/takes/{take_id}/content", json={"content": content, "word_count": words})
    assert r.status_code == 200, r.text
    return r.json()


def test_one_take_until_another_version_is_tried(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    assert _takes(client, scene) == []
    assert client.get(f"/api/structure/{scene.id}").json()["take_count"] == 1

    takes = _try(client, scene)
    # Take 1 is the prose so far and counts; take 2 is a copy of it, open in the editor.
    assert _shape(takes) == [(1, "first draft", True, False), (2, "", False, True)]
    assert [t["content"] for t in takes] == [FIRST, FIRST]
    assert [t["word_count"] for t in takes] == [14, 14]
    assert client.get(f"/api/structure/{scene.id}").json()["take_count"] == 2
    listed = {s["title"]: s for c in client.get(f"/api/stories/{story.id}/structure").json() for s in c["children"]}
    assert (listed["Arrival"]["take_count"], listed["Supper"]["take_count"]) == (2, 1)

    # A third copies the open take, as it now reads.
    _write(client, takes[1]["id"], SECOND, 9)
    takes = _try(client, scene)
    assert _shape(takes) == [(1, "first draft", True, False), (2, "", False, False), (3, "", False, True)]
    assert takes[2]["content"] == SECOND

    # One ⌘Z takes the third away; another takes the second and first with it.
    _undo(client, story)
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, False), (2, "", False, True)]
    _undo(client, story)
    assert _takes(client, scene) == []
    _redo(client, story)
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, False), (2, "", False, True)]


def test_typing_in_a_take_that_does_not_count_leaves_the_scene_alone(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    first, second = _try(client, scene)
    saved = _write(client, second["id"], SECOND, 9)
    assert (saved["content"], saved["word_count"]) == (SECOND, 9)
    db_session.expire_all()
    assert (db_session.get(StructureNode, scene.id).content, db_session.get(StructureNode, scene.id).word_count) == (
        FIRST,
        14,
    )
    # Typing is the editor's history, not ⌘Z's: undo reaches the version tried before it.
    _undo(client, story)
    assert _takes(client, scene) == []
    # The take that counts saves as the scene, not here.
    _redo(client, story)
    r = client.put(f"/api/takes/{first['id']}/content", json={"content": "<p>x</p>", "word_count": 1})
    assert r.status_code == 400


def test_switching_takes_and_back_with_undo(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    first, second = _try(client, scene)
    r = client.post(f"/api/takes/{first['id']}/open")
    assert r.status_code == 200, r.text
    assert _shape(r.json()["takes"]) == [(1, "first draft", True, True), (2, "", False, False)]
    _undo(client, story)
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, False), (2, "", False, True)]


def test_use_this_take_makes_it_the_scenes_prose_everywhere(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    first, second = _try(client, scene)
    _write(client, second["id"], SECOND, 9)
    r = client.post(f"/api/takes/{second['id']}/use")
    assert r.status_code == 200, r.text
    takes = r.json()["takes"]
    # Take 2 counts and keeps its number; take 1 keeps the words that counted.
    assert _shape(takes) == [(1, "first draft", False, False), (2, "", True, True)]
    assert [(t["content"], t["word_count"]) for t in takes] == [(FIRST, 14), (SECOND, 9)]
    db_session.expire_all()
    node = db_session.get(StructureNode, scene.id)
    assert (node.content, node.word_count) == (SECOND, 9)
    # Only the take that counts is read: the structure's counts, the manuscript and an export.
    listed = {s["title"]: s for c in client.get(f"/api/stories/{story.id}/structure").json() for s in c["children"]}
    assert listed["Arrival"]["word_count"] == 9
    manuscript = client.get(f"/api/stories/{story.id}/manuscript").json()
    arrival = next(s for s in manuscript["sections"] if s["heading"] == "Arrival")
    assert ("keeper" in arrival["content"], "waxed coat" in arrival["content"]) == (True, False)
    text = client.post(f"/api/stories/{story.id}/export", json={"format": "txt"}).text
    assert "You’ll be the keeper" in text and "waxed coat" not in text
    # The row of the take that counts holds no copy of the prose.
    assert db_session.query(SceneTake).filter_by(id=second["id"]).one().content == ""

    # One ⌘Z puts take 1 back as the scene's prose; ⇧⌘Z chooses take 2 again.
    _undo(client, story)
    db_session.expire_all()
    assert db_session.get(StructureNode, scene.id).content == FIRST
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, False), (2, "", False, True)]
    assert _takes(client, scene)[1]["content"] == SECOND
    _redo(client, story)
    db_session.expire_all()
    assert db_session.get(StructureNode, scene.id).content == SECOND


def test_rename_and_delete_takes(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    first, second = _try(client, scene)
    third = _try(client, scene)[2]
    r = client.patch(f"/api/takes/{second['id']}", json={"label": "Calder speaks first"})
    assert r.status_code == 200, r.text
    assert [t["label"] for t in r.json()["takes"]] == ["first draft", "Calder speaks first", ""]
    _undo(client, story)
    assert [t["label"] for t in _takes(client, scene)] == ["first draft", "", ""]

    # The take that counts is not deleted until another counts.
    r = client.delete(f"/api/takes/{first['id']}")
    assert r.status_code == 400
    assert "Choose another to count first" in r.json()["detail"]

    # Deleting the open take opens the one that counts; the rest are numbered again.
    r = client.delete(f"/api/takes/{third['id']}")
    assert r.status_code == 200, r.text
    assert _shape(r.json()["takes"]) == [(1, "first draft", True, True), (2, "", False, False)]
    # Down to one take, the scene has no takes left to show: its prose is the one.
    r = client.delete(f"/api/takes/{second['id']}")
    assert r.json()["takes"] == []
    db_session.expire_all()
    assert db_session.get(StructureNode, scene.id).content == FIRST
    # ⌘Z brings both back, one at a time.
    _undo(client, story)
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, True), (2, "", False, False)]
    _undo(client, story)
    assert _shape(_takes(client, scene)) == [
        (1, "first draft", True, False),
        (2, "", False, False),
        (3, "", False, True),
    ]


def test_a_scene_with_takes_is_not_split_or_joined(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    _try(client, scene)
    r = client.post(
        f"/api/structure/{scene.id}/split", json={"content": "<p>The knock</p>", "new_content": "<p>came.</p>"}
    )
    assert r.status_code == 400
    assert "has 2 takes" in r.json()["detail"]
    r = client.post(f"/api/structure/{scene.id}/merge-next", json={})
    assert r.status_code == 400
    assert "has 2 takes" in r.json()["detail"]


def test_deleting_a_scene_takes_its_takes_and_undo_brings_them_back(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    _try(client, scene)
    assert client.delete(f"/api/structure/{scene.id}").status_code == 204
    db_session.expire_all()
    assert db_session.query(SceneTake).filter_by(node_id=scene.id).count() == 0
    _undo(client, story)
    assert _shape(_takes(client, scene)) == [(1, "first draft", True, False), (2, "", False, True)]


def test_snapshots_carry_takes(client, db_session, test_user):
    story, scene = _scene(db_session, test_user)
    first, second = _try(client, scene)
    _write(client, second["id"], SECOND, 9)
    snap = svc.create_snapshot(story.id, db_session, trigger="manual", name="takes", force=True)
    db_session.commit()
    assert {t["id"] for t in svc.serialize_story(story.id, db_session)["scene_takes"]} == {first["id"], second["id"]}

    client.delete(f"/api/takes/{second['id']}")
    assert _takes(client, scene) == []
    svc.restore_snapshot(snap, db_session, create_safety_backup=False)
    db_session.commit()
    db_session.expire_all()
    takes = _takes(client, scene)
    assert _shape(takes) == [(1, "first draft", True, False), (2, "", False, True)]
    assert takes[1]["content"] == SECOND


def test_another_writers_takes_are_not_reached(client, db_session):
    import uuid

    from app.models import User

    stranger = User(
        id=str(uuid.uuid4()), username="other", password_hash="x", display_name="O", is_admin=False, settings={}
    )
    db_session.add(stranger)
    db_session.flush()
    story, nodes = build_findings_story(db_session, stranger)
    scene = nodes["Arrival"]
    take = SceneTake(node_id=scene.id, counts=True, is_open=True)
    db_session.add(take)
    db_session.commit()
    assert client.get(f"/api/structure/{scene.id}/takes").status_code == 404
    assert client.post(f"/api/structure/{scene.id}/takes").status_code == 404
    assert client.post(f"/api/takes/{take.id}/open").status_code == 404
    assert client.delete(f"/api/takes/{take.id}").status_code == 404
