"""Idea fragments (doc 10 P2) until Freewrite replaces them (doc 15 N3)."""

H = {"X-Client-Id": "tab-1"}


def _story(client):
    return client.post("/api/stories", json={"title": "T", "scaffold": False}).json()["id"]


def test_idea_fragments_round_trip_on_the_story(client):
    sid = _story(client)
    fragments = [
        {"id": "f1", "text": "A keeper who hides things.", "created_at": "2026-09-29", "filed": None},
        {
            "id": "f2",
            "text": "Calder",
            "created_at": "2026-09-29",
            "filed": {"kind": "character", "ref_id": "c", "label": "Calder"},
        },
    ]
    r = client.patch(f"/api/stories/{sid}", json={"idea_fragments": fragments}, headers=H)
    assert r.status_code == 200, r.text
    assert client.get(f"/api/stories/{sid}").json()["idea_fragments"] == fragments


def test_idea_name_suggestions_leave_out_the_cast(client):
    sid = _story(client)
    client.post(f"/api/stories/{sid}/characters", json={"name": "Eleanor Vance"})
    r = client.post(
        f"/api/stories/{sid}/ideas/names",
        json={"texts": {"f1": "Eleanor rows out to meet Nell at Portsmouth."}},
    )
    assert r.status_code == 200, r.text
    names = {n["name"]: n["kind"] for n in r.json()["names"]["f1"]}
    assert names.get("Portsmouth") == "place" and "Eleanor" not in names


def test_a_filed_idea_reaches_the_character_as_a_note(client):
    sid = _story(client)
    note = {
        "id": "n1",
        "text": "Runs the ferry.",
        "scene_id": None,
        "scene_title": "Your ideas",
        "timestamp": "t",
        "confirmed": True,
    }
    c = client.post(f"/api/stories/{sid}/characters", json={"name": "Nell", "discovery_notes": [note]}).json()
    assert c["discovery_notes"] == [note]
    second = {**note, "id": "n2", "text": "Lost a sister."}
    r = client.patch(f"/api/characters/{c['id']}", json={"discovery_notes": [note, second]})
    assert [n["id"] for n in r.json()["discovery_notes"]] == ["n1", "n2"]
