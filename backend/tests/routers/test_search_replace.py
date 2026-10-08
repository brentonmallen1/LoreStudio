"""Story-wide replace must only touch prose, never markup or speaker tags."""

from app.services.prose_rewrite import replace_words


def test_replace_leaves_tags_and_attributes_alone():
    html = '<p class="Maya">"Hello," said <b>Maya</b>. Maya smiled.</p><p>"Bye"&lt;Maya&gt;</p>'
    out, n = replace_words(html, "Maya", "Mara", case_sensitive=True, whole_word=True)
    assert n == 2
    assert 'class="Maya"' in out  # attribute untouched
    assert '"Bye"&lt;Maya&gt;' in out  # speaker tag untouched
    assert "<b>Mara</b>" in out and "Mara smiled" in out


def test_a_replacement_is_text_not_a_template(client):
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    a = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "A", "content": "<p>Tea at four.</p>", "level": 0, "level_type": "scene"},
    ).json()
    r = client.post(f"/api/stories/{sid}/replace", json={"query": "four", "replacement": r"five \1 & six"})
    assert r.status_code == 200
    assert client.get(f"/api/structure/{a['id']}").json()["content"] == "<p>Tea at five \\1 &amp; six.</p>"


def test_replace_endpoint_scoped_and_whole_word(client):
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    a = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "A", "content": "<p>The cat sat. Concatenate.</p>", "level": 0, "level_type": "scene"},
    ).json()
    b = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "B", "content": "<p>Another cat.</p>", "level": 0, "level_type": "scene"},
    ).json()
    r = client.post(
        f"/api/stories/{sid}/replace",
        json={"query": "cat", "replacement": "dog", "whole_word": True, "node_ids": [a["id"]]},
    )
    assert r.status_code == 200
    assert r.json() == {"replaced_count": 1, "scenes_affected": 1, "node_ids": [a["id"]]}
    assert client.get(f"/api/structure/{a['id']}").json()["content"] == "<p>The dog sat. Concatenate.</p>"
    assert "cat" in client.get(f"/api/structure/{b['id']}").json()["content"]


def test_a_bulk_rewrite_moves_the_scene_on_and_says_so(client):
    """
    An open editor holding the old text must not be able to save it back unopposed: the
    scene's updated_at has to move, so that save meets a 409. And a rewrite across many
    scenes is visible under Chronicle › Changes as one batch, like any prose edit.
    """
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    a = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "A", "content": '<p>"Elenor," he said.</p>', "level": 0, "level_type": "scene"},
    ).json()
    b = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "B", "content": "<p>Elenor waited.</p>", "level": 0, "level_type": "scene"},
    ).json()

    r = client.post(
        f"/api/stories/{sid}/replace", json={"query": "Elenor", "replacement": "Eleanor", "whole_word": True}
    )
    assert sorted(r.json()["node_ids"]) == sorted([a["id"], b["id"]])

    stale = client.patch(
        f"/api/structure/{a['id']}", json={"content": "<p>stale</p>", "expected_updated_at": a["updated_at"]}
    )
    assert stale.status_code == 409

    q = client.post(f"/api/stories/{sid}/quotes/normalize", json={"style": "curly"}).json()
    assert [s["node_id"] for s in q["scenes"]] == [a["id"]]

    changes = client.get(f"/api/stories/{sid}/changes").json()
    rows = changes.get("changes", changes) if isinstance(changes, dict) else changes
    labels = [c["label"] for c in rows]
    assert "Replace “Elenor” with “Eleanor” in 2 scenes" in labels
    assert "Curly quotes in “A”" in labels
    assert all(c["undoable"] for c in rows if "Replace" in c["label"] or "quotes" in c["label"])


H = {"X-Client-Id": "tab-1"}


def _scene(client, sid, title, content):
    return client.post(
        f"/api/stories/{sid}/structure",
        json={"title": title, "content": content, "level": 0, "level_type": "scene"},
        headers=H,
    ).json()


def test_replace_and_quotes_undo_and_redo_as_one_step_each(client):
    """Every rewrite of the prose is a step ⌘Z takes back, whole (doc 23 P5b)."""
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    a = _scene(client, sid, "A", '<p>"Elenor," he said.</p>')
    b = _scene(client, sid, "B", "<p>Elenor waited.</p>")
    text = lambda n: client.get(f"/api/structure/{n['id']}").json()["content"]  # noqa: E731

    client.post(f"/api/stories/{sid}/replace", json={"query": "Elenor", "replacement": "Eleanor"}, headers=H)
    client.post(f"/api/stories/{sid}/quotes/normalize", json={"style": "curly"}, headers=H)
    assert text(a) == "<p>“Eleanor,” he said.</p>"

    undone = client.post(f"/api/stories/{sid}/undo", headers=H).json()
    assert undone["label"] == "Curly quotes in “A”" and undone["scene_ids"] == [a["id"]]
    assert text(a) == '<p>"Eleanor," he said.</p>'
    undone = client.post(f"/api/stories/{sid}/undo", headers=H).json()
    assert sorted(undone["scene_ids"]) == sorted([a["id"], b["id"]])
    assert (text(a), text(b)) == ('<p>"Elenor," he said.</p>', "<p>Elenor waited.</p>")

    redone = client.post(f"/api/stories/{sid}/redo", headers=H).json()
    assert redone["label"].startswith("Replace") and len(redone["scene_ids"]) == 2
    assert text(b) == "<p>Eleanor waited.</p>"


def test_undo_leaves_a_scene_written_in_since(client):
    """The open editor saved new words after the replace: undo refuses rather than lose them."""
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    a = _scene(client, sid, "A", "<p>Elenor waited.</p>")
    client.post(f"/api/stories/{sid}/replace", json={"query": "Elenor", "replacement": "Eleanor"}, headers=H)
    client.patch(f"/api/structure/{a['id']}", json={"content": "<p>Eleanor waited. Then left.</p>"}, headers=H)
    r = client.post(f"/api/stories/{sid}/undo", headers=H)
    assert r.status_code == 409 and "edited again" in r.json()["detail"]
    assert client.get(f"/api/structure/{a['id']}").json()["content"] == "<p>Eleanor waited. Then left.</p>"


def test_a_response_names_the_change_it_recorded(client):
    """The client's undo timeline learns of a change the moment it lands: the batch and its
    story in two headers. Typing (autosave), undo and redo are not new steps, so they carry none."""
    sid = client.post("/api/stories", json={"title": "T"}).json()["id"]
    created = client.post(
        f"/api/stories/{sid}/structure", json={"title": "A", "level": 0, "level_type": "scene"}, headers=H
    )
    batch = created.headers["X-Change-Batch"]
    assert created.headers["X-Change-Story"] == sid
    rows = client.get(f"/api/stories/{sid}/changes").json()
    assert rows[0]["batch_id"] == batch

    saved = client.patch(f"/api/structure/{created.json()['id']}", json={"content": "<p>Words</p>"}, headers=H)
    assert "X-Change-Batch" not in saved.headers
    assert "X-Change-Batch" not in client.post(f"/api/stories/{sid}/undo", headers=H).headers
    assert "X-Change-Batch" not in client.post(f"/api/stories/{sid}/redo", headers=H).headers
    assert "X-Change-Batch" not in client.get(f"/api/stories/{sid}/changes").headers
