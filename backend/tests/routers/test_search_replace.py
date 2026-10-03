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
    assert any("Replace “Elenor” with “Eleanor”" in label for label in labels)
    assert any("Curly quotes" in label for label in labels)
    assert all(not c["undoable"] for c in rows if "Replace" in c["label"] or "quotes" in c["label"])
