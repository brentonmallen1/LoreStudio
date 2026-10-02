"""Freewrite (doc 15 N3): a page per story for loose writing."""

H = {"X-Client-Id": "tab-1"}


def _story(client):
    return client.post("/api/stories", json={"title": "T", "scaffold": False}).json()["id"]


def test_the_page_saves_and_comes_back(client):
    sid = _story(client)
    assert client.get(f"/api/stories/{sid}/freewrite").json() == {"html": ""}
    html = '<h3>Thursday 1 October</h3><p>A keeper who <span data-made="note:n1">stayed</span>.</p>'
    assert client.put(f"/api/stories/{sid}/freewrite", json={"html": html}).status_code == 200
    assert client.get(f"/api/stories/{sid}/freewrite").json()["html"] == html
    # Saving is like typing prose: not an undoable change.
    assert client.get(f"/api/stories/{sid}/changes").json() == []


def test_a_page_too_long_is_refused(client):
    sid = _story(client)
    r = client.put(f"/api/stories/{sid}/freewrite", json={"html": "x" * 2_000_001})
    assert r.status_code == 413


def test_someone_elses_story_is_not_found(client):
    assert client.get("/api/stories/nope/freewrite").status_code == 404


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
