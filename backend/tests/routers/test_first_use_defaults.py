"""Defaults that presume nothing (first-use polish, A5): a new character has no role until the
author gives one, and a relationship needs no narrative purpose to be saved."""


def _story(client) -> str:
    return client.post("/api/stories", json={"title": "T"}).json()["id"]


def test_a_new_character_has_no_role(client):
    sid = _story(client)
    r = client.post(f"/api/stories/{sid}/characters", json={"name": "Eleanor"})
    assert r.status_code == 201, r.text
    assert r.json()["role"] == ""


def test_a_relationship_saves_without_a_narrative_purpose(client):
    sid = _story(client)
    a = client.post(f"/api/stories/{sid}/characters", json={"name": "Eleanor"}).json()
    b = client.post(f"/api/stories/{sid}/characters", json={"name": "Tom"}).json()
    r = client.post(
        f"/api/characters/{a['id']}/relationships",
        json={"related_character_id": b["id"], "relationship_type": "ally"},
    )
    assert r.status_code in (200, 201), r.text
    assert r.json()["narrative_purpose"] == []
    rel = r.json()["id"]
    r = client.patch(f"/api/characters/relationships/{rel}", json={"narrative_purpose": []})
    assert r.status_code == 200, r.text
