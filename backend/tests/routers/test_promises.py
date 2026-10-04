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


def _thread(client, sid, roles: dict[str, str] | None = None, **body) -> dict:
    """A thread whose scenes do what `roles` says ({node_id: role})."""
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Th", **body}).json()
    for node_id, role in (roles or {}).items():
        r = client.post(f"/api/threads/{th['id']}/appearances", json={"node_id": node_id, "role": role})
        assert r.status_code == 201, r.text
    return _get_thread(client, sid, th["id"])


def _get_thread(client, sid, thread_id) -> dict:
    return next(t for t in client.get(f"/api/stories/{sid}/threads").json() if t["id"] == thread_id)


def _twist(client, sid, clues=(), **body) -> dict:
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw", **body}).json()
    for clue in clues:
        r = client.post(f"/api/twists/{tw['id']}/clues", json=clue)
        assert r.status_code == 201, r.text
    return client.get(f"/api/twists/{tw['id']}").json()


def _undo(client, sid):
    r = client.post(f"/api/stories/{sid}/undo")
    assert r.status_code == 200, r.text


def test_clearing_a_reveal_scene_and_a_threads_opening_works(client):
    sid = _story(client)
    s1, s2, _ = _scenes(client, sid)
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw", "revealed_at_node_id": s2}).json()
    r = client.patch(f"/api/twists/{tw['id']}", json={"revealed_at_node_id": None})
    assert r.json()["revealed_at_node_id"] is None
    th = _thread(client, sid, {s1: "opens"}, mice_type="idea")
    r = client.patch(f"/api/threads/{th['id']}", json={"mice_type": None})
    assert r.json()["mice_type"] is None
    # A null on a field that may not be null is ignored, not written.
    r = client.patch(f"/api/threads/{th['id']}", json={"name": None, "set_aside": True})
    assert r.json()["name"] == "Th" and r.json()["status"] == "set_aside"


def test_a_scene_from_another_story_is_refused(client):
    sid, other = _story(client), _story(client, "Other")
    (foreign,) = _scenes(client, other, 1)
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw"}).json()
    assert client.patch(f"/api/twists/{tw['id']}", json={"revealed_at_node_id": foreign}).status_code == 422
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Th"}).json()
    assert client.post(f"/api/threads/{th['id']}/appearances", json={"node_id": foreign}).status_code == 422


def test_thread_and_twist_values_are_checked(client):
    sid = _story(client)
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Th"}).json()
    (s1,) = _scenes(client, sid, 1)
    bad = client.post(f"/api/threads/{th['id']}/appearances", json={"node_id": s1, "role": "ends"})
    assert bad.status_code == 422
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
    clue = {"node_id": s2, "text": "ash", "points_to": "truth", "subtlety": "hidden"}
    tw = _twist(client, sid, [clue], revealed_at_node_id=s2)
    th = _thread(client, sid, {s1: "opens", s2: "closes"}, mice_type="idea")
    assert th["status"] == "resolved"
    assert client.delete(f"/api/structure/{s2}").status_code in (200, 204)
    after = client.get(f"/api/twists/{tw['id']}").json()
    assert after["revealed_at_node_id"] is None and after["clues"][0]["node_id"] is None
    thread = _get_thread(client, sid, th["id"])
    assert thread["closes_at_node_id"] is None and thread["status"] == "open"
    _undo(client, sid)
    back = client.get(f"/api/twists/{tw['id']}").json()
    assert back["revealed_at_node_id"] == s2 and back["clues"][0]["node_id"] == s2
    thread = _get_thread(client, sid, th["id"])
    assert thread["closes_at_node_id"] == s2 and thread["status"] == "resolved"


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


# B2: what the Assistant is given --------------------------------------------------------


def test_thread_analysis_sends_the_tries_and_scenes_as_stored(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"overall_rating": "fair"})
    sid = _story(client)
    s1, s2, s3 = _scenes(client, sid)
    th = _thread(client, sid, {s1: "opens", s3: "closes"}, mice_type="idea")
    r = client.post(
        f"/api/threads/{th['id']}/appearances", json={"node_id": s2, "role": "fails", "note": "She hides the log"}
    )
    assert r.status_code == 201
    assert client.post(f"/api/threads/{th['id']}/analyze").status_code == 200
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert "a try fails: She hides the log" in prompt and "? → ?" not in prompt
    assert f"[{s2}] S2 (a try fails)" in prompt
    assert prompt.index(f"[{s1}] S1 (opens it)") < prompt.index(f"[{s3}] S3 (closes it)")
    assert "<p>" not in prompt


def test_twist_analysis_says_when_a_clue_comes_after_the_reveal(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"overall_rating": "fair"})
    sid = _story(client)
    s1, s2, s3 = _scenes(client, sid)
    clues = [
        {"node_id": s1, "text": "ash", "points_to": "truth", "subtlety": "hidden"},
        {"node_id": s3, "text": "late", "points_to": "truth", "subtlety": "obvious"},
    ]
    tw = _twist(client, sid, clues, revealed_at_node_id=s2)
    assert client.post(f"/api/twists/{tw['id']}/analyze").status_code == 200
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert "[S1] (before the reveal)" in prompt and "[S3] (AFTER the reveal)" in prompt


def test_twist_impact_knows_the_clues_and_the_reveal(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"overall_assessment": "ok"})
    sid = _story(client)
    _, s2, _ = _scenes(client, sid)
    clue = {"node_id": s2, "text": "woodsmoke by the cabinet", "points_to": "truth"}
    tw = _twist(client, sid, [clue], revealed_at_node_id=s2)
    assert client.post(f"/api/twists/{tw['id']}/analyze-impact").status_code == 200
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert "Revealed in: S2" in prompt and "woodsmoke by the cabinet" in prompt


def test_a_scanned_event_names_its_twist_and_people_by_id(client, mock_ai_gateway):
    sid = _story(client)
    (s1,) = _scenes(client, sid, 1)
    ch = client.post(f"/api/stories/{sid}/characters", json={"name": "Eleanor Vance"}).json()
    tw = client.post(f"/api/stories/{sid}/twists", json={"name": "The Visitor"}).json()
    gw = mock_ai_gateway(
        structured_data={
            "events": [
                {
                    "node_id": s1,
                    "knowledge_type": "character_learns",
                    "subject": "She knows",
                    "characters_who_know": ["Eleanor"],
                    "twist": "the visitor",
                }
            ]
        }
    )
    assert client.post(f"/api/stories/{sid}/reader-knowledge/scan").json()["proposed"] == 1
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert "Eleanor Vance" in prompt and "The Visitor" in prompt
    proposal = next(
        p for p in client.get(f"/api/stories/{sid}/proposals").json()["proposals"] if p["subject"] == "She knows"
    )
    r = client.post(f"/api/stories/{sid}/proposals/{proposal['id']}/act", json={"action": "add"})
    assert r.status_code == 200, r.text
    (event,) = client.get(f"/api/stories/{sid}/reader-knowledge").json()
    assert event["characters_who_know"] == [ch["id"]] and event["twist_id"] == tw["id"]


# C1: one list of scenes per thread, clues as rows, a colour per twist ----------------------


def test_a_threads_status_follows_its_scenes(client):
    sid = _story(client)
    s1, s2, s3 = _scenes(client, sid)
    th = _thread(client, sid)
    assert th["status"] == "planned"
    th = _thread(client, sid, {s1: "opens", s2: "moves"})
    assert th["status"] == "open" and th["opens_at_node_id"] == s1 and th["closes_at_node_id"] is None
    r = client.patch(f"/api/threads/{th['id']}/appearances/{s2}", json={"role": "closes", "note": "answered"})
    assert r.json()["role"] == "closes" and r.json()["note"] == "answered"
    assert _get_thread(client, sid, th["id"])["status"] == "resolved"
    # Placing a scene already on the thread says what it does there.
    r = client.post(f"/api/threads/{th['id']}/appearances", json={"node_id": s2, "role": "turns"})
    assert r.json()["role"] == "turns" and len(_get_thread(client, sid, th["id"])["appearances"]) == 2
    _undo(client, sid)
    assert _get_thread(client, sid, th["id"])["closes_at_node_id"] == s2
    assert client.patch(f"/api/threads/{th['id']}/appearances/{s3}", json={"role": "opens"}).status_code == 404


def test_clues_are_rows_that_undo_and_set_the_twists_status(client):
    sid = _story(client)
    s1, s2, _ = _scenes(client, sid)
    tw = _twist(client, sid)
    assert tw["status"] == "planned" and tw["color_slot"] == 7
    r = client.post(f"/api/twists/{tw['id']}/clues", json={"text": "ash", "quote": "a smell of woodsmoke"})
    clue = r.json()
    assert clue["node_id"] is None and clue["quote"] == "a smell of woodsmoke" and clue["position"] == 0
    assert client.get(f"/api/twists/{tw['id']}").json()["status"] == "planned"
    r = client.patch(f"/api/twist-clues/{clue['id']}", json={"node_id": s1, "points_to": "misdirection"})
    assert r.json()["node_id"] == s1 and r.json()["points_to"] == "misdirection"
    assert client.get(f"/api/twists/{tw['id']}").json()["status"] == "seeding"
    assert [t["id"] for t in client.get(f"/api/structure/{s1}/twists").json()] == [tw["id"]]
    assert client.patch(f"/api/twist-clues/{clue['id']}", json={"subtlety": "loud"}).status_code == 422
    client.patch(f"/api/twists/{tw['id']}", json={"revealed_at_node_id": s2, "color_slot": 5})
    after = client.get(f"/api/twists/{tw['id']}").json()
    assert after["status"] == "revealed" and after["color_slot"] == 5
    assert client.delete(f"/api/twist-clues/{clue['id']}").status_code == 204
    assert client.get(f"/api/twists/{tw['id']}").json()["clues"] == []
    _undo(client, sid)
    assert client.get(f"/api/twists/{tw['id']}").json()["clues"][0]["id"] == clue["id"]


def test_deleting_a_twist_takes_its_clues_and_undo_brings_them_back(client):
    sid = _story(client)
    (s1,) = _scenes(client, sid, 1)
    tw = _twist(client, sid, [{"node_id": s1, "text": "ash"}, {"text": "smoke"}])
    assert client.delete(f"/api/twists/{tw['id']}").status_code == 204
    _undo(client, sid)
    back = client.get(f"/api/twists/{tw['id']}").json()
    assert [c["text"] for c in back["clues"]] == ["ash", "smoke"]
