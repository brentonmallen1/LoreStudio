"""Story-wide replace must only touch prose, never markup or speaker tags."""

import re

from app.routers.search import replace_in_text_nodes


def test_replace_leaves_tags_and_attributes_alone():
    html = '<p class="Maya">"Hello," said <b>Maya</b>. Maya smiled.</p><p>"Bye"<Maya></p>'
    pattern = re.compile(r"\bMaya\b")
    out, n = replace_in_text_nodes(html, pattern, "Mara")
    assert n == 2
    assert 'class="Maya"' in out  # attribute untouched
    assert "<Maya>" in out or "<maya>" in out  # speaker tag untouched
    assert "<b>Mara</b>" in out and "Mara smiled" in out


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
    assert r.json() == {"replaced_count": 1, "scenes_affected": 1}
    assert client.get(f"/api/structure/{a['id']}").json()["content"] == "<p>The dog sat. Concatenate.</p>"
    assert "cat" in client.get(f"/api/structure/{b['id']}").json()["content"]
