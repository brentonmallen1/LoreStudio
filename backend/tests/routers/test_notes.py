"""Notes (doc 15): margin notes, questions, to-dos and ideas in one table."""

H = {"X-Client-Id": "tab-1"}


def _story(client):
    return client.post("/api/stories", json={"title": "T", "scaffold": False}).json()["id"]


def _scene(client, sid, title="The Light"):
    body = {"title": title, "level": 0, "level_type": "scene", "position": 0, "content": "<p>Hi</p>"}
    return client.post(f"/api/stories/{sid}/structure", json=body).json()["id"]


def test_kinds_are_listed_apart_and_together(client):
    sid = _story(client)
    nid = _scene(client, sid)
    client.post(f"/api/stories/{sid}/notes", json={"content": "Fix the storm scene", "kind": "todo"})
    q = client.post(
        f"/api/stories/{sid}/notes",
        json={"content": "Why did she leave?", "kind": "question", "about_type": "character", "about_id": "c1"},
        headers=H,
    ).json()
    margin = client.post(
        f"/api/stories/{sid}/notes",
        json={"id": "m1", "content": "Echo this later", "node_id": nid, "anchor": "very still"},
    ).json()
    assert q["kind"] == "question" and q["about_type"] == "character" and q["answer"] == ""
    assert margin["id"] == "m1" and margin["kind"] == "note" and margin["node_title"] == "The Light"
    todos = client.get(f"/api/stories/{sid}/notes", params={"kind": "todo"}).json()
    assert [n["content"] for n in todos] == ["Fix the storm scene"]
    both = client.get(f"/api/stories/{sid}/notes", params={"kind": ["todo", "question"]}).json()
    assert len(both) == 2
    assert [n["id"] for n in client.get(f"/api/stories/{sid}/notes", params={"node_id": nid}).json()] == ["m1"]
    about = client.get(f"/api/stories/{sid}/notes", params={"about_type": "character", "about_id": "c1"}).json()
    assert [n["id"] for n in about] == [q["id"]]
    assert len(client.get(f"/api/stories/{sid}/notes").json()) == 3
    assert client.get(f"/api/stories/{sid}/changes").json()[0]["label"] == "Add note “Echo this later”"


def test_a_note_id_is_taken_once(client):
    sid = _story(client)
    assert client.post(f"/api/stories/{sid}/notes", json={"id": "x", "content": "a"}).status_code == 201
    assert client.post(f"/api/stories/{sid}/notes", json={"id": "x", "content": "b"}).status_code == 409


def test_answering_is_undoable_and_clearing_done_todos_keeps_questions(client):
    sid = _story(client)
    q = client.post(f"/api/stories/{sid}/notes", json={"content": "Who lit the lamp?", "kind": "question"}).json()
    client.patch(f"/api/notes/{q['id']}", json={"answer": "Margaret did.", "done": True}, headers=H)
    client.post(f"/api/stories/{sid}/notes", json={"content": "done todo", "kind": "todo", "done": True})
    client.delete(f"/api/stories/{sid}/notes/done")
    kept = client.get(f"/api/stories/{sid}/notes", params={"kind": "question"}).json()
    assert kept[0]["answer"] == "Margaret did." and kept[0]["done"] is True
    assert client.get(f"/api/stories/{sid}/notes", params={"kind": "todo"}).json() == []
    assert client.get(f"/api/stories/{sid}/notes", params={"open": True}).json() == []
    # Undo is per tab: this tab's last change is the answer (the done to-do came from no tab).
    undo = client.post(f"/api/stories/{sid}/undo", headers=H).json()
    assert "question" in undo["label"]
    assert client.get(f"/api/notes/{q['id']}").json()["answer"] == ""


def test_a_note_can_change_kind_and_be_untied(client):
    sid = _story(client)
    nid = _scene(client, sid)
    n = client.post(f"/api/stories/{sid}/notes", json={"content": "Maybe a storm", "kind": "idea"}).json()
    r = client.patch(f"/api/notes/{n['id']}", json={"kind": "todo", "node_id": nid})
    assert (r.json()["kind"], r.json()["node_id"]) == ("todo", nid)
    r = client.patch(f"/api/notes/{n['id']}", json={"node_id": None, "content": None})
    assert r.json()["node_id"] is None and r.json()["content"] == "Maybe a storm"


def test_deleting_is_undoable(client):
    sid = _story(client)
    n = client.post(f"/api/stories/{sid}/notes", json={"content": "keep"}, headers=H).json()
    client.delete(f"/api/notes/{n['id']}", headers=H)
    assert client.get(f"/api/notes/{n['id']}").status_code == 404
    client.post(f"/api/stories/{sid}/undo", headers=H)
    assert client.get(f"/api/notes/{n['id']}").json()["content"] == "keep"


def test_a_deleted_scene_leaves_its_notes_untied(client):
    sid = _story(client)
    nid = _scene(client, sid)
    n = client.post(f"/api/stories/{sid}/notes", json={"content": "keep", "node_id": nid}).json()
    client.delete(f"/api/structure/{nid}")
    assert client.get(f"/api/notes/{n['id']}").json()["node_id"] is None


def test_another_users_story_is_not_found(client):
    assert client.get("/api/stories/nope/notes").status_code == 404
    assert client.get("/api/notes/nope").status_code == 404


def test_an_editorial_pass_replaces_its_own_margin_notes_and_keeps_the_authors(client, db_session):
    from app.models.note import Note
    from app.routers.editorial import _apply_editorial_notes

    sid = _story(client)
    nid = _scene(client, sid)
    client.post(f"/api/stories/{sid}/notes", json={"content": "mine", "node_id": nid, "anchor": "Hi"})
    sections = [{"id": nid, "title": "The Light"}]
    first = [{"section_title": "The Light", "anchor": "Hi", "note": "Too quiet?", "category": "pacing"}]
    _apply_editorial_notes(sections, first, "r1", db_session)
    second = [
        {"section_title": "The Light", "anchor": "Hi", "comment": "Now too loud."},
        {"section_title": "The Light"},
    ]
    _apply_editorial_notes(sections, second, "r2", db_session)
    rows = {n.content: n for n in db_session.query(Note).filter(Note.node_id == nid)}
    assert set(rows) == {"mine", "Now too loud."}
    assert (rows["Now too loud."].source, rows["Now too loud."].anchor) == ("editorial-r2", "Hi")
    assert rows["mine"].source is None


def test_export_leaves_the_note_marks_out():
    from app.services.manuscript_builder import _clean_mentions

    html = '<p>The sea was <span data-note-id="n1" class="note-anchor">very <em>still</em></span>.</p>'
    assert _clean_mentions(html) == "<p>The sea was <span>very <em>still</em></span>.</p>"


def test_an_old_snapshot_brings_its_notes_todos_and_story_notes():
    from app.services.snapshot_legacy import legacy_notes

    state = {
        "notes": [
            {"id": "s1", "story_id": "s", "title": "From the Snowflake tab", "content": "A keeper"},
            {"id": "s2", "story_id": "s", "title": "Untitled Note", "content": ""},
        ],
        "todos": [{"id": "t1", "story_id": "s", "kind": "todo", "content": "fix", "doc_from": 3}],
        "structure_nodes": [
            {"id": "n", "story_id": "s", "inline_notes": [{"id": "m1", "anchor": "still", "note": "echo"}]},
            {"id": "o", "story_id": "s", "metadata_": {"inline_notes": [{"id": "m2", "note": "old"}]}},
        ],
    }
    rows = {r["id"]: r for r in legacy_notes(state)}
    assert set(rows) == {"s1", "t1", "m1", "m2"}
    assert rows["s1"]["kind"] == "idea" and rows["m1"]["node_id"] == "n" and rows["m2"]["node_id"] == "o"
    assert rows["m1"]["anchor"] == "still"
    # 0024: the story row's unsorted ideas come back as ideas; sorted ones do not.
    old = {
        "story": {
            "id": "s",
            "idea_fragments": [
                {"id": "f1", "text": "A keeper"},
                {"id": "f2", "text": "x", "filed": {"kind": "character"}},
            ],
        }
    }
    assert [r["id"] for r in legacy_notes(old)] == ["f1"]
    # A snapshot taken after doc 15 has note rows only, and passes them through.
    assert legacy_notes({"notes": [{"id": "x", "kind": "question", "content": "?"}]})[0]["kind"] == "question"
