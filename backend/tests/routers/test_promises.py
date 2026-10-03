"""Threads, twists, what the reader knows and scene links: the data bugs doc 18 found (B1).

Each test failed before the fix.
"""


def _story(client, title="T") -> str:
    return client.post("/api/stories", json={"title": title}).json()["id"]


def _scenes(client, sid, n=3) -> list[str]:
    ids = []
    for i in range(n):
        r = client.post(
            f"/api/stories/{sid}/structure",
            json={"title": f"S{i + 1}", "content": "<p>x</p>", "level": 0, "level_type": "scene", "position": i},
        )
        ids.append(r.json()["id"])
    return ids


def _undo(client, sid):
    r = client.post(f"/api/stories/{sid}/undo")
    assert r.status_code == 200, r.text


def test_clearing_a_reveal_scene_and_a_threads_opening_works(client):
    sid = _story(client)
    s1, s2, _ = _scenes(client, sid)
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw", "revealed_at_node_id": s2}).json()
    r = client.patch(f"/api/twists/{tw['id']}", json={"revealed_at_node_id": None})
    assert r.json()["revealed_at_node_id"] is None
    th = client.post(
        f"/api/stories/{sid}/threads", json={"name": "Th", "mice_type": "idea", "opens_at_node_id": s1}
    ).json()
    r = client.patch(f"/api/threads/{th['id']}", json={"opens_at_node_id": None, "mice_type": None})
    assert r.json()["opens_at_node_id"] is None and r.json()["mice_type"] is None
    # A null on a field that may not be null is ignored, not written.
    r = client.patch(f"/api/threads/{th['id']}", json={"name": None, "status": "developing"})
    assert r.json()["name"] == "Th" and r.json()["status"] == "developing"


def test_a_scene_from_another_story_is_refused(client):
    sid, other = _story(client), _story(client, "Other")
    (foreign,) = _scenes(client, other, 1)
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw"}).json()
    assert client.patch(f"/api/twists/{tw['id']}", json={"revealed_at_node_id": foreign}).status_code == 422
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Th"}).json()
    assert client.post(f"/api/threads/{th['id']}/appearances", json={"node_id": foreign}).status_code == 422


def test_thread_and_twist_values_are_checked(client):
    sid = _story(client)
    assert client.post(f"/api/stories/{sid}/threads", json={"name": "Th", "status": "done"}).status_code == 422
    assert client.post(f"/api/stories/{sid}/twists", json={"name": "Tw", "twist_type": "plot"}).status_code == 422


def test_what_the_reader_knows_reads_front_to_back_names_people_and_undoes(client):
    sid = _story(client)
    s1, s2, s3 = _scenes(client, sid)
    ch = client.post(f"/api/stories/{sid}/characters", json={"name": "Eleanor Vance"}).json()
    for node, subject in ((s3, "late"), (s1, "early"), (s2, "middle")):
        r = client.post(
            f"/api/stories/{sid}/reader-knowledge",
            json={
                "node_id": node,
                "knowledge_type": "character_learns",
                "subject": subject,
                "characters_who_know": ["eleanor", "Nobody"],
            },
        )
        assert r.status_code == 201, r.text
        assert r.json()["characters_who_know"] == [ch["id"]]
    events = client.get(f"/api/stories/{sid}/reader-knowledge").json()
    assert [e["subject"] for e in events] == ["early", "middle", "late"]
    _undo(client, sid)
    assert len(client.get(f"/api/stories/{sid}/reader-knowledge").json()) == 2


def test_deleting_a_scene_detaches_clues_and_undo_puts_them_back(client):
    sid = _story(client)
    s1, s2, s3 = _scenes(client, sid)
    clue = {"id": "c1", "node_id": s2, "text": "ash", "points_to": "truth", "subtlety": "hidden"}
    tw = client.post(
        f"/api/stories/{sid}/twists", json={"name": "Tw", "revealed_at_node_id": s2, "clues": [clue]}
    ).json()
    th = client.post(
        f"/api/stories/{sid}/threads",
        json={
            "name": "Th",
            "mice_type": "idea",
            "opens_at_node_id": s1,
            "closes_at_node_id": s2,
            "try_fail_cycles": [{"id": "y", "description": "d", "outcome": "fail_setback", "node_id": s2}],
        },
    ).json()
    assert client.delete(f"/api/structure/{s2}").status_code in (200, 204)
    after = client.get(f"/api/twists/{tw['id']}").json()
    assert after["revealed_at_node_id"] is None and after["clues"][0]["node_id"] is None
    thread = next(t for t in client.get(f"/api/stories/{sid}/threads").json() if t["id"] == th["id"])
    assert thread["closes_at_node_id"] is None and thread["try_fail_cycles"][0]["node_id"] is None
    _undo(client, sid)
    back = client.get(f"/api/twists/{tw['id']}").json()
    assert back["revealed_at_node_id"] == s2 and back["clues"][0]["node_id"] == s2
    thread = next(t for t in client.get(f"/api/stories/{sid}/threads").json() if t["id"] == th["id"])
    assert thread["closes_at_node_id"] == s2 and thread["try_fail_cycles"][0]["node_id"] == s2


def test_scene_links_have_known_types_point_the_right_way_and_undo(client):
    sid = _story(client)
    s1, _, s3 = _scenes(client, sid)
    body = {"story_id": sid, "source_node_id": s1, "target_node_id": s3}
    assert client.post("/api/scene-links", json={**body, "link_type": "mirror"}).status_code == 422
    # Drawn from the earlier scene: a callback still points back.
    link = client.post("/api/scene-links", json={**body, "link_type": "callback"}).json()
    assert (link["source_node_id"], link["target_node_id"]) == (s3, s1)
    _undo(client, sid)
    assert client.get(f"/api/scene-links?story_id={sid}").json() == []
