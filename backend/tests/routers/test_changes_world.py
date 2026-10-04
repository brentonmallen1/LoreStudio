"""Undo/redo for the world, research and plotting entities: create, edit and delete each one."""

import pytest

H1 = {"X-Client-Id": "tab-1"}

# (list/create url under the story, item url, create body, field to edit, new value)
ENTITIES = [
    ("cultures", "cultures", {"name": "Tidefolk"}, "values", "Hospitality"),
    ("world-systems", "world-systems", {"name": "Lamp-lore"}, "rules", "The flame answers"),
    ("calendars", "calendars", {"name": "Keeper's reckoning"}, "epoch_name", "After the Wreck"),
    ("eras", "eras", {"name": "The Dark Years"}, "description", "No light on the point"),
    ("historical-events", "historical-events", {"name": "The Wreck"}, "causes", "A doused lamp"),
    ("compendium/notes", "compendium", {"title": "Tide tables"}, "category", "research"),
    ("twists", "twists", {"name": "The letter"}, "the_truth", "Mara wrote it"),
    ("threads", "threads", {"name": "Lost ship"}, "description", "The Ardent, lost with all hands"),
]
IDS = [e[0] for e in ENTITIES]


def _story(client):
    return client.post("/api/stories", json={"title": "T"}).json()["id"]


def _list(client, sid, create_path):
    return client.get(f"/api/stories/{sid}/{create_path.split('/')[0]}").json()


def _find(client, sid, create_path, item_id):
    return next((r for r in _list(client, sid, create_path) if r["id"] == item_id), None)


def _undo(client, sid):
    r = client.post(f"/api/stories/{sid}/undo", headers=H1)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize(("create_path", "item_path", "body", "field", "value"), ENTITIES, ids=IDS)
def test_create_edit_delete_undo(client, create_path, item_path, body, field, value):
    sid = _story(client)
    r = client.post(f"/api/stories/{sid}/{create_path}", json=body, headers=H1)
    assert r.status_code == 201, r.text
    item = r.json()

    # create -> undo removes it, redo brings it back
    assert _undo(client, sid)["label"].startswith("Add")
    assert _find(client, sid, create_path, item["id"]) is None
    assert client.post(f"/api/stories/{sid}/redo", headers=H1).status_code == 200
    assert _find(client, sid, create_path, item["id"]) is not None

    # edit -> undo restores the old value
    old = _find(client, sid, create_path, item["id"])[field]
    assert client.patch(f"/api/{item_path}/{item['id']}", json={field: value}, headers=H1).status_code == 200
    assert field in _undo(client, sid)["label"]
    assert _find(client, sid, create_path, item["id"])[field] == old

    # delete -> undo brings it back
    assert client.delete(f"/api/{item_path}/{item['id']}", headers=H1).status_code == 204
    assert _find(client, sid, create_path, item["id"]) is None
    assert _undo(client, sid)["label"].startswith("Delete")
    assert _find(client, sid, create_path, item["id"]) is not None


def test_era_delete_undo_restores_its_events(client):
    sid = _story(client)
    era = client.post(f"/api/stories/{sid}/eras", json={"name": "The Dark Years"}).json()
    client.post(f"/api/stories/{sid}/historical-events", json={"name": "The Wreck", "era_id": era["id"]})
    client.delete(f"/api/eras/{era['id']}", headers=H1)
    assert client.get(f"/api/stories/{sid}/historical-events").json() == []
    _undo(client, sid)
    events = client.get(f"/api/stories/{sid}/historical-events").json()
    assert [(e["name"], e["era_id"]) for e in events] == [("The Wreck", era["id"])]


def test_thread_appearances_undo_and_survive_thread_delete(client):
    sid = _story(client)
    scene = client.post(f"/api/stories/{sid}/structure", json={"title": "Storm", "level": 0, "level_type": "scene"})
    node_id = scene.json()["id"]
    thread = client.post(f"/api/stories/{sid}/threads", json={"name": "Lost ship"}).json()
    appearances = f"/api/threads/{thread['id']}/appearances"

    def count():
        return sum(len(t["appearances"]) for t in client.get(f"/api/stories/{sid}/threads").json())

    client.post(appearances, json={"node_id": node_id}, headers=H1)
    assert _undo(client, sid)["label"] == "Add Lost ship to scene “Storm”"
    assert count() == 0

    client.post(appearances, json={"node_id": node_id}, headers=H1)
    client.delete(f"{appearances}/{node_id}", headers=H1)
    assert _undo(client, sid)["label"].startswith("Remove Lost ship")
    assert count() == 1

    client.delete(f"/api/threads/{thread['id']}", headers=H1)
    _undo(client, sid)
    assert count() == 1


def test_compendium_attachments_undo(client):
    sid = _story(client)
    entry = client.post(f"/api/stories/{sid}/compendium/notes", json={"title": "Tide tables"}).json()
    char = client.post(f"/api/stories/{sid}/characters", json={"name": "Mara"}).json()
    attached = f"/api/compendium/attachments/character/{char['id']}"
    att = client.post(
        f"/api/compendium/{entry['id']}/attach", json={"object_type": "character", "object_id": char["id"]}, headers=H1
    ).json()
    client.delete(f"/api/compendium/attachments/{att['id']}", headers=H1)
    assert _undo(client, sid)["label"] == "Detach “Tide tables”"
    assert len(client.get(attached).json()) == 1
    # deleting the entry takes its attachments; undo restores both
    client.delete(f"/api/compendium/{entry['id']}", headers=H1)
    assert client.get(attached).json() == []
    _undo(client, sid)
    assert len(client.get(attached).json()) == 1


def test_clue_link_undo_and_braces_in_names(client):
    sid = _story(client)
    scene = client.post(f"/api/stories/{sid}/structure", json={"title": "S", "level": 0, "level_type": "scene"}).json()
    twist = client.post(f"/api/stories/{sid}/twists", json={"name": "The {letter}"}).json()
    clue = client.post(f"/api/twists/{twist['id']}/clues", json={"text": "Ink on her cuff"}, headers=H1).json()
    r = client.patch(f"/api/twist-clues/{clue['id']}", json={"node_id": scene["id"]}, headers=H1)
    assert r.status_code == 200, r.text
    assert _undo(client, sid)["label"] == "Edit node_id on a clue for The {letter}"
    assert client.get(f"/api/twists/{twist['id']}").json()["clues"][0].get("node_id") is None
    # a name with braces must not break the "Edit {fields}" label
    client.patch(f"/api/twists/{twist['id']}", json={"twist_type": "identity"}, headers=H1)
    assert _undo(client, sid)["label"] == "Edit twist_type on twist The {letter}"


def test_compendium_list_previews_each_entry(client):
    sid = _story(client)
    long_text = "<p>" + ("Storm records from the Maine coast. " * 10) + "</p>"
    client.post(f"/api/stories/{sid}/compendium/notes", json={"title": "Storms", "content": long_text})
    [entry] = client.get(f"/api/stories/{sid}/compendium").json()
    assert entry["preview"].startswith("Storm records from the Maine coast.")
    assert "<p>" not in entry["preview"]
    assert entry["preview"].endswith("…") and len(entry["preview"]) <= 181
