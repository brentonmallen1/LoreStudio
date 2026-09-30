"""Undo/redo through the change log: structure, characters, outlines; per-tab isolation; conflicts."""

H1 = {"X-Client-Id": "tab-1"}
H2 = {"X-Client-Id": "tab-2"}


def _story(client):
    return client.post("/api/stories", json={"title": "T"}).json()["id"]


def _scene(client, sid, title="S", parent=None, position=0, content="<p>Hi</p>", headers=H1):
    body = {
        "title": title,
        "level": 0 if not parent else 1,
        "level_type": "scene",
        "position": position,
        "content": content,
    }
    if parent:
        body["parent_id"] = parent
    r = client.post(f"/api/stories/{sid}/structure", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_first_words_turn_a_planned_scene_into_a_draft(client):
    sid = _story(client)
    r = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "Plan", "level": 0, "level_type": "scene", "status": "planned", "synopsis": "She lies."},
        headers=H1,
    )
    n = r.json()
    assert n["status"] == "planned"
    # Saving an empty editor keeps it planned; the first words make it a draft.
    client.patch(f"/api/structure/{n['id']}", json={"content": "<p></p>", "word_count": 0}, headers=H1)
    assert client.get(f"/api/structure/{n['id']}").json()["status"] == "planned"
    client.patch(f"/api/structure/{n['id']}", json={"content": "<p>The lamp</p>", "word_count": 2}, headers=H1)
    assert client.get(f"/api/structure/{n['id']}").json()["status"] == "draft"
    changes = client.get(f"/api/stories/{sid}/changes").json()
    assert "became a draft" in changes[0]["label"] and changes[0]["undoable"] is False
    # Undo reaches past it to the create, never to a planned scene holding prose.
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).json()["label"].startswith("Add scene")


def test_rename_undo_redo(client):
    sid = _story(client)
    n = _scene(client, sid, "Lamp")
    client.patch(f"/api/structure/{n['id']}", json={"title": "Storm"}, headers=H1)
    st = client.get(f"/api/stories/{sid}/undo/state", headers=H1).json()
    assert st["can_undo"] and "Rename" in st["undo_label"] and not st["can_redo"]
    r = client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert r.status_code == 200, r.text
    assert client.get(f"/api/structure/{n['id']}").json()["title"] == "Lamp"
    st = client.get(f"/api/stories/{sid}/undo/state", headers=H1).json()
    assert st["can_redo"] and "Rename" in st["redo_label"]
    client.post(f"/api/stories/{sid}/redo", headers=H1)
    assert client.get(f"/api/structure/{n['id']}").json()["title"] == "Storm"


def test_prose_edits_are_logged_but_not_undoable(client):
    sid = _story(client)
    n = _scene(client, sid)
    client.patch(f"/api/structure/{n['id']}", json={"content": "<p>v2</p>", "word_count": 1}, headers=H1)
    changes = client.get(f"/api/stories/{sid}/changes").json()
    assert changes[0]["action"] == "content" and changes[0]["undoable"] is False
    # only the create is undoable
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).json()["label"].startswith("Add scene")
    assert client.get(f"/api/structure/{n['id']}").status_code == 404


def test_delete_subtree_undo_restores_children_and_links(client):
    sid = _story(client)
    ch = client.post(f"/api/stories/{sid}/structure", json={"title": "Ch", "level": 0, "level_type": "chapter"}).json()
    a = _scene(client, sid, "A", parent=ch["id"], position=0, content='<p>"Go," said Mara.</p>')
    b = _scene(client, sid, "B", parent=ch["id"], position=1)
    client.post(
        "/api/scene-links",
        json={"story_id": sid, "source_node_id": a["id"], "target_node_id": b["id"], "link_type": "callback"},
    )
    r = client.delete(f"/api/structure/{ch['id']}", headers=H1)
    assert r.status_code == 204
    assert client.get(f"/api/structure/{a['id']}").status_code == 404
    r = client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert r.status_code == 200, r.text
    assert client.get(f"/api/structure/{a['id']}").json()["parent_id"] == ch["id"]
    assert client.get(f"/api/structure/{b['id']}").status_code == 200
    links = client.get("/api/scene-links", params={"node_id": a["id"]}).json()
    assert len(links) == 1
    # redo deletes again
    client.post(f"/api/stories/{sid}/redo", headers=H1)
    assert client.get(f"/api/structure/{ch['id']}").status_code == 404


def test_reorder_undo(client):
    sid = _story(client)
    a = _scene(client, sid, "A", position=0)
    b = _scene(client, sid, "B", position=1)
    ops = [
        {"node_id": b["id"], "parent_id": None, "position": 0},
        {"node_id": a["id"], "parent_id": None, "position": 1},
    ]
    assert client.post(f"/api/stories/{sid}/structure/reorder", json={"operations": ops}, headers=H1).status_code == 204
    assert client.get(f"/api/structure/{a['id']}").json()["position"] == 1
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).json()["label"] == "Reorder sections"
    assert client.get(f"/api/structure/{a['id']}").json()["position"] == 0


def test_undo_is_per_tab_unless_asked(client):
    sid = _story(client)
    n = _scene(client, sid, "Lamp", headers=H2)
    client.patch(f"/api/structure/{n['id']}", json={"title": "Other tab"}, headers=H2)
    assert client.get(f"/api/stories/{sid}/undo/state", headers=H1).json()["can_undo"] is False
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).status_code == 404
    assert client.post(f"/api/stories/{sid}/undo", headers=H1, params={"any_client": "true"}).status_code == 200
    assert client.get(f"/api/structure/{n['id']}").json()["title"] == "Lamp"


def test_new_edit_clears_redo_and_conflict_is_409(client):
    sid = _story(client)
    n = _scene(client, sid, "Lamp")
    client.patch(f"/api/structure/{n['id']}", json={"title": "Storm"}, headers=H1)
    client.post(f"/api/stories/{sid}/undo", headers=H1)
    client.patch(f"/api/structure/{n['id']}", json={"status": "final"}, headers=H1)
    assert client.get(f"/api/stories/{sid}/undo/state", headers=H1).json()["can_redo"] is False
    # someone else changes the title; undoing the status edit is fine, undoing the rename is not
    client.patch(f"/api/structure/{n['id']}", json={"title": "Tide"}, headers=H2)
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).status_code == 200  # status back to draft
    client.patch(f"/api/structure/{n['id']}", json={"title": "Tide 2"}, headers=H2)
    # tab-2 tries to undo its first rename (Tide) but the title is now Tide 2 -> conflict
    r = client.post(f"/api/stories/{sid}/undo", headers=H2)  # undoes Tide 2 -> Tide (fine)
    assert r.status_code == 200
    client.patch(f"/api/structure/{n['id']}", json={"title": "Sideways"}, headers=H1)
    r = client.post(f"/api/stories/{sid}/undo", headers=H2)  # would set Tide -> Lamp but title is Sideways
    assert r.status_code == 409
    # Said in the author's words, not as a column name.
    assert r.json()["detail"].startswith("The title of “Sideways” was edited again after that change")


def test_character_delete_undo_restores_relationships(client):
    sid = _story(client)
    a = client.post(f"/api/stories/{sid}/characters", json={"name": "Mara"}).json()
    b = client.post(f"/api/stories/{sid}/characters", json={"name": "Tomas"}).json()
    r = client.post(
        f"/api/characters/{a['id']}/relationships", json={"related_character_id": b["id"], "relationship_type": "rival"}
    )
    assert r.status_code == 201, r.text
    assert client.delete(f"/api/characters/{a['id']}", headers=H1).status_code == 204
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).status_code == 200
    assert client.get(f"/api/characters/{a['id']}").status_code == 200
    assert len(client.get(f"/api/characters/{a['id']}/relationships").json()) == 1


def test_outline_item_undo(client):
    sid = _story(client)
    outline = client.post(f"/api/stories/{sid}/outlines", json={"name": "Main"}).json()
    item = client.post(f"/api/outlines/{outline['id']}/items", json={"text": "Act 1"}, headers=H1).json()
    client.patch(f"/api/outline-items/{item['id']}", json={"text": "Act One"}, headers=H1)
    client.post(f"/api/stories/{sid}/undo", headers=H1)
    items = client.get(f"/api/outlines/{outline['id']}").json()["items"]
    assert items[0]["text"] == "Act 1"
    client.delete(f"/api/outline-items/{item['id']}", headers=H1)
    client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert len(client.get(f"/api/outlines/{outline['id']}").json()["items"]) == 1


def test_story_relationship_todo_location_undo(client):
    sid = _story(client)
    # story identity
    client.patch(f"/api/stories/{sid}", json={"logline": "A keeper hides a letter."}, headers=H1)
    assert "logline" in client.get(f"/api/stories/{sid}/undo/state", headers=H1).json()["undo_label"]
    client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert client.get(f"/api/stories/{sid}").json()["logline"] == ""
    # relationship
    a = client.post(f"/api/stories/{sid}/characters", json={"name": "Mara"}).json()
    b = client.post(f"/api/stories/{sid}/characters", json={"name": "Tomas"}).json()
    rel = client.post(
        f"/api/characters/{a['id']}/relationships",
        json={"related_character_id": b["id"], "relationship_type": "rival"},
        headers=H1,
    ).json()
    client.delete(f"/api/characters/relationships/{rel['id']}", headers=H1)
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).json()["label"].startswith("Delete relationship")
    assert len(client.get(f"/api/characters/{a['id']}/relationships").json()) == 1
    # todos: create, edit, reorder
    t1 = client.post(f"/api/stories/{sid}/todos", json={"content": "one"}, headers=H1).json()
    t2 = client.post(f"/api/stories/{sid}/todos", json={"content": "two"}, headers=H1).json()
    client.post(f"/api/stories/{sid}/todos/reorder", json={"todo_ids": [t2["id"], t1["id"]]}, headers=H1)
    assert client.get(f"/api/todos/{t1['id']}").json()["position"] == 1
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).json()["label"] == "Reorder TODOs"
    assert client.get(f"/api/todos/{t1['id']}").json()["position"] == 0
    client.patch(f"/api/todos/{t1['id']}", json={"done": True}, headers=H1)
    client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert client.get(f"/api/todos/{t1['id']}").json()["done"] is False
    # location with a child and a scene setting
    scene = _scene(client, sid, "S")
    parent = client.post(f"/api/stories/{sid}/locations", json={"name": "Island"}, headers=H1).json()
    child = client.post(
        f"/api/stories/{sid}/locations", json={"name": "Tower", "parent_id": parent["id"]}, headers=H1
    ).json()
    client.post("/api/scene-settings", json={"location_id": child["id"], "node_id": scene["id"], "role": "primary"})
    assert client.delete(f"/api/locations/{parent['id']}", headers=H1).status_code == 204
    assert client.get(f"/api/locations/{child['id']}").status_code == 404
    assert client.post(f"/api/stories/{sid}/undo", headers=H1).status_code == 200
    assert client.get(f"/api/locations/{child['id']}").status_code == 200
    assert len(client.get(f"/api/structure/{scene['id']}/scene-settings").json()) == 1


def test_prune_keeps_newest(client, db_session):
    from app.services import change_log

    sid = _story(client)
    for i in range(6):
        _scene(client, sid, f"S{i}")
    removed = change_log.prune(db_session, sid, keep=3)
    assert removed == 3
    rows = client.get(f"/api/stories/{sid}/changes").json()
    assert [r["label"] for r in rows] == ["Add scene “S5”", "Add scene “S4”", "Add scene “S3”"]
