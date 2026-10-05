"""A scene's date and era (series v2), and links on a scene that can be cleared."""

H = {"X-Client-Id": "tab-1"}


def _scene(client):
    sid = client.post("/api/stories", json={"title": "T", "scaffold": False}).json()["id"]
    node = client.post(
        f"/api/stories/{sid}/structure", json={"title": "The Letter", "level": 0, "level_type": "scene"}, headers=H
    ).json()
    era = client.post(f"/api/stories/{sid}/eras", json={"name": "The Keeper's Era"}).json()
    char = client.post(f"/api/stories/{sid}/characters", json={"name": "Thomas"}).json()
    return sid, node, era, char


def test_a_scene_has_a_date_and_an_era_and_undo_takes_them_back(client):
    sid, node, era, _ = _scene(client)
    r = client.patch(
        f"/api/structure/{node['id']}", json={"in_world_date": "November 1962", "era_id": era["id"]}, headers=H
    )
    assert (r.json()["in_world_date"], r.json()["era_id"]) == ("November 1962", era["id"])
    tree = client.get(f"/api/stories/{sid}/structure").json()
    assert tree[0]["in_world_date"] == "November 1962" and tree[0]["era_id"] == era["id"]

    assert client.patch(f"/api/structure/{node['id']}", json={"era_id": ""}, headers=H).json()["era_id"] is None
    assert client.post(f"/api/stories/{sid}/undo", headers=H).status_code == 200
    assert client.get(f"/api/structure/{node['id']}").json()["era_id"] == era["id"]


def test_a_scene_pov_cleared_goes_back_to_the_story_and_other_edits_leave_it(client):
    _, node, _, char = _scene(client)
    client.patch(f"/api/structure/{node['id']}", json={"pov_character_id": char["id"]}, headers=H)
    # An edit that does not name the POV leaves it alone.
    assert (
        client.patch(f"/api/structure/{node['id']}", json={"title": "A Letter"}, headers=H).json()["pov_character_id"]
        == char["id"]
    )
    r = client.patch(f"/api/structure/{node['id']}", json={"pov_character_id": None}, headers=H)
    assert r.json()["pov_character_id"] is None
