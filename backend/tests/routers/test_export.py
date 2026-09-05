"""Export contract tests. Pandoc-based formats run only where pandoc is installed."""

import shutil

import pytest


def _story_with_scenes(client):
    sid = client.post("/api/stories", json={"title": "Lamp Light"}).json()["id"]
    client.patch(f"/api/stories/{sid}", json={"author_name": "R. Keeper"})
    ch = client.post(
        f"/api/stories/{sid}/structure", json={"title": "Chapter One", "level": 0, "level_type": "chapter"}
    ).json()
    for i, title in enumerate(["The Lamp", "The Storm"]):
        client.post(
            f"/api/stories/{sid}/structure",
            json={
                "title": title,
                "parent_id": ch["id"],
                "level": 1,
                "level_type": "scene",
                "position": i,
                "content": f"<p>Scene {title} text.</p>",
            },
        )
    return sid


def test_txt_export_has_title_byline_and_every_scene(client):
    sid = _story_with_scenes(client)
    r = client.post(f"/api/stories/{sid}/export", json={"format": "txt", "include_scene_titles": True})
    assert r.status_code == 200, r.text
    body = r.content.decode()
    assert body.startswith("LAMP LIGHT")
    assert "by R. Keeper" in body
    assert "Scene The Lamp text." in body and "Scene The Storm text." in body
    assert r.headers["content-disposition"].endswith('.txt"')


def test_manuscript_sections_endpoint(client):
    sid = _story_with_scenes(client)
    r = client.get(f"/api/stories/{sid}/manuscript")
    assert r.status_code == 200
    titles = (
        [s["heading"] for s in r.json()["sections"]] if isinstance(r.json(), dict) else [s["heading"] for s in r.json()]
    )
    assert "The Lamp" in titles and "The Storm" in titles


def test_unknown_format_rejected(client):
    sid = _story_with_scenes(client)
    assert client.post(f"/api/stories/{sid}/export", json={"format": "wordperfect"}).status_code == 400


@pytest.mark.skipif(shutil.which("pandoc") is None, reason="pandoc not installed")
@pytest.mark.parametrize("fmt", ["docx", "epub", "markdown", "html", "odt"])
def test_pandoc_formats_round_trip(client, fmt):
    sid = _story_with_scenes(client)
    r = client.post(f"/api/stories/{sid}/export", json={"format": fmt, "include_scene_titles": True})
    assert r.status_code == 200, r.text
    assert len(r.content) > 100
    if fmt in ("markdown", "html"):
        text = r.content.decode()
        assert "The Lamp" in text and "The Storm" in text and "R. Keeper" in text
