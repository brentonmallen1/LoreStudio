"""GET /stories/{id}/promises (doc 18 C2): the tapestry's one answer."""


def _story(client) -> str:
    return client.post("/api/stories", json={"title": "T"}).json()["id"]


def _scenes(client, sid, n) -> list[str]:
    ch = client.post(
        f"/api/stories/{sid}/structure", json={"title": "Ch 1", "level": 0, "level_type": "chapter", "position": 0}
    ).json()["id"]
    ids = []
    for i in range(n):
        node = client.post(
            f"/api/stories/{sid}/structure",
            json={"title": f"S{i + 1}", "level": 1, "level_type": "scene", "parent_id": ch, "position": i},
        ).json()["id"]
        if i < n - 1:  # the last is planned: no prose yet
            client.patch(f"/api/structure/{node}", json={"content": "<p>words here</p>", "word_count": 2})
        ids.append(node)
    return ids


def _place(client, thread_id, node_id, role):
    assert (
        client.post(f"/api/threads/{thread_id}/appearances", json={"node_id": node_id, "role": role}).status_code == 201
    )


def test_the_view_reads_front_to_back(client):
    sid = _story(client)
    s = _scenes(client, sid, 6)
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Logs"}).json()
    for node, role in ((s[3], "closes"), (s[0], "opens"), (s[1], "fails")):
        _place(client, th["id"], node, role)
    tw = client.post(
        f"/api/stories/{sid}/twists", json={"name": "Lie", "the_truth": "He lied", "revealed_at_node_id": s[4]}
    ).json()
    client.post(f"/api/twists/{tw['id']}/clues", json={"node_id": s[2], "text": "ash", "points_to": "truth"})
    client.post(
        f"/api/twists/{tw['id']}/clues", json={"node_id": s[0], "text": "honest man", "points_to": "misdirection"}
    )
    client.post(f"/api/twists/{tw['id']}/clues", json={"text": "unplaced"})
    client.post(
        "/api/scene-links",
        json={"story_id": sid, "source_node_id": s[3], "target_node_id": s[0], "link_type": "callback", "note": "n"},
    )
    v = client.get(f"/api/stories/{sid}/promises").json()

    assert [x["title"] for x in v["scenes"]] == ["S1", "S2", "S3", "S4", "S5", "S6"]
    assert v["scenes"][5]["written"] is False and v["scenes"][0]["written"] is True
    assert v["chapters"] == [{"id": v["scenes"][0]["chapter_id"], "title": "Ch 1", "first": 0, "count": 6}]
    (thread,) = v["threads"]
    assert [(b["index"], b["role"]) for b in thread["beats"]] == [(0, "opens"), (1, "fails"), (3, "closes")]
    assert thread["status"] == "resolved"
    (twist,) = v["twists"]
    assert [c["text"] for c in twist["clues"]] == ["honest man", "ash", "unplaced"]
    assert twist["reveal_index"] == 4 and twist["color_slot"] == 7
    (setup,) = v["setups"]
    assert (setup["from_index"], setup["to_index"], setup["link_type"]) == (0, 3, "callback")

    rows = {r["index"]: r for r in v["reader"]}
    assert [i["text"] for i in rows[0]["believes"]] == ["honest man"]
    assert [i["text"] for i in rows[2]["learns"]] == ["ash"]
    assert [i["text"] for i in rows[4]["learns"]] == ["He lied"]
    assert [(i["text"], i["over"]) for i in rows[4]["believes"]] == [("honest man", True)]
    assert v["checks"] == []


def test_hand_entries_join_what_the_reader_knows(client):
    sid = _story(client)
    s = _scenes(client, sid, 3)
    old = client.post(
        f"/api/stories/{sid}/reader-knowledge",
        json={"node_id": s[0], "knowledge_type": "misdirection_planted", "subject": "A historian", "is_truth": False},
    ).json()
    client.post(
        f"/api/stories/{sid}/reader-knowledge",
        json={"node_id": s[1], "knowledge_type": "reader_only", "subject": "She knew his name"},
    )
    client.post(
        f"/api/stories/{sid}/reader-knowledge",
        json={
            "node_id": s[2],
            "knowledge_type": "truth_revealed",
            "subject": "Not a historian",
            "supersedes_id": old["id"],
        },
    )
    rows = {r["index"]: r for r in client.get(f"/api/stories/{sid}/promises").json()["reader"]}
    assert rows[0]["believes"][0]["source"] == "you"
    assert rows[1]["only"][0]["text"] == "She knew his name"
    assert rows[2]["learns"][0]["text"] == "Not a historian"
    assert rows[2]["believes"][0] == {**rows[2]["believes"][0], "text": "A historian", "over": True}


def test_the_checks(client):
    sid = _story(client)
    s = _scenes(client, sid, 8)
    quiet = client.post(f"/api/stories/{sid}/threads", json={"name": "Quiet"}).json()
    _place(client, quiet["id"], s[0], "opens")
    _place(client, quiet["id"], s[5], "closes")
    backwards = client.post(f"/api/stories/{sid}/threads", json={"name": "Backwards"}).json()
    _place(client, backwards["id"], s[1], "closes")
    _place(client, backwards["id"], s[2], "opens")
    aside = client.post(f"/api/stories/{sid}/threads", json={"name": "Aside", "set_aside": True}).json()
    _place(client, aside["id"], s[0], "opens")
    _place(client, aside["id"], s[7], "closes")
    late = client.post(f"/api/stories/{sid}/twists", json={"name": "Late", "revealed_at_node_id": s[3]}).json()
    client.post(f"/api/twists/{late['id']}/clues", json={"node_id": s[4], "text": "x", "points_to": "truth"})
    other = client.post(f"/api/stories/{sid}/twists", json={"name": "Other", "revealed_at_node_id": s[3]}).json()
    client.post(f"/api/twists/{other['id']}/clues", json={"node_id": s[1], "text": "y", "points_to": "truth"})
    astray = client.post(f"/api/stories/{sid}/twists", json={"name": "Astray"}).json()
    client.post(f"/api/twists/{astray['id']}/clues", json={"node_id": s[1], "text": "z", "points_to": "misdirection"})

    checks = client.get(f"/api/stories/{sid}/promises").json()["checks"]
    got = {(c["check"], c.get("thread_id") or c.get("twist_id")) for c in checks}
    assert ("quiet_thread", quiet["id"]) in got
    assert ("closes_before_opens", backwards["id"]) in got
    assert ("clue_after_reveal", late["id"]) in got
    assert ("reveal_without_clue", late["id"]) in got
    assert ("reveal_without_clue", other["id"]) not in got
    assert ("misdirection_unanswered", astray["id"]) in got
    assert any(c["check"] == "shared_reveal" for c in checks)
    assert not any(c.get("thread_id") == aside["id"] for c in checks)
    q = next(c for c in checks if c["check"] == "quiet_thread")
    assert q["text"] == "Quiet says nothing for 4 scenes, between S1 and S6" and q["node_id"] == s[1]


def test_another_users_story_is_not_found(client):
    assert client.get("/api/stories/nope/promises").status_code == 404


def test_a_belief_overturned_where_it_is_planted_shows_once(client):
    sid = _story(client)
    s = _scenes(client, sid, 2)
    tw = client.post(
        f"/api/stories/{sid}/twists", json={"name": "Tw", "the_truth": "t", "revealed_at_node_id": s[1]}
    ).json()
    old = client.post(
        f"/api/stories/{sid}/reader-knowledge",
        json={
            "node_id": s[0],
            "knowledge_type": "misdirection_planted",
            "subject": "A historian",
            "twist_id": tw["id"],
        },
    ).json()
    client.post(
        f"/api/stories/{sid}/reader-knowledge",
        json={"node_id": s[0], "knowledge_type": "reader_only", "subject": "She knew", "supersedes_id": old["id"]},
    )
    rows = {r["index"]: r for r in client.get(f"/api/stories/{sid}/promises").json()["reader"]}
    assert [(i["text"], i["over"]) for i in rows[0]["believes"]] == [("A historian", True)]
    assert rows[1]["believes"] == []
