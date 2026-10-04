"""Replacing an image's file keeps the image (doc 14 Q5)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.media import AssetAttachment, StoryAsset
from app.models.story import Story
from app.services import media_files


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(media_files, "UPLOADS_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def story(db_session: Session, test_user) -> Story:
    s = Story(title="Pictures", user_id=test_user.id)
    db_session.add(s)
    db_session.commit()
    return s


def _upload(client: TestClient, story_id: str, name: str, body: bytes, mime: str = "image/png") -> dict:
    res = client.post(f"/api/stories/{story_id}/media/upload", files={"file": (name, body, mime)})
    assert res.status_code == 201, res.text
    return res.json()


def test_replace_keeps_the_caption_and_every_use(client: TestClient, db_session: Session, story, uploads):
    asset = _upload(client, story.id, "cottage.png", b"old picture")
    client.patch(f"/api/media/{asset['id']}", json={"alt_text": "The keeper's cottage"})
    db_session.add(AssetAttachment(asset_id=asset["id"], object_type="setting", object_id="loc-1"))
    db_session.commit()
    old_file = uploads / db_session.get(StoryAsset, asset["id"]).stored_path

    res = client.put(f"/api/media/{asset['id']}/file", files={"file": ("cottage-v2.jpg", b"new!", "image/jpeg")})

    assert res.status_code == 200, res.text
    out = res.json()
    assert out["id"] == asset["id"]
    assert out["alt_text"] == "The keeper's cottage"
    assert out["original_filename"] == "cottage-v2.jpg"
    assert out["mime_type"] == "image/jpeg"
    assert out["size_bytes"] == 4
    db_session.expire_all()
    stored = db_session.get(StoryAsset, asset["id"])
    assert stored is not None and len(stored.attachments) == 1
    assert (uploads / stored.stored_path).read_bytes() == b"new!"
    assert not old_file.exists()


def test_replace_refuses_a_file_it_would_not_upload(client: TestClient, db_session: Session, story, uploads):
    asset = _upload(client, story.id, "map.png", b"a map")

    res = client.put(f"/api/media/{asset['id']}/file", files={"file": ("map.exe", b"MZ", "application/x-msdownload")})

    assert res.status_code == 415
    stored = db_session.get(StoryAsset, asset["id"])
    assert stored is not None and (uploads / stored.stored_path).read_bytes() == b"a map"


def test_the_file_is_served_for_revalidation(client: TestClient, story, uploads, auth_token):
    asset = _upload(client, story.id, "map.png", b"a map")

    res = client.get(f"/api/media/{asset['id']}/file", params={"token": auth_token})

    assert res.status_code == 200
    assert res.headers["cache-control"] == "no-cache"
