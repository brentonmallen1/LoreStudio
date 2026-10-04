"""Uploaded files on disk: one folder per book, ``{uploads}/{story_id}/``.

A file belongs to one asset row. Deleting or replacing an asset removes its file, so two
rows never share one: a copy into another book (an image carried with a character, research
shared with the series) gets its own file (``copy_asset``).
"""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ..config import settings
from ..models.media import StoryAsset

UPLOADS_DIR = Path(settings.uploads_path)


def uploads_dir() -> Path:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOADS_DIR


def write_upload(story_id: str, asset_id: str, filename: str | None, contents: bytes) -> str:
    """Write the bytes under the story's folder; returns the stored path."""
    story_dir = uploads_dir() / story_id
    story_dir.mkdir(exist_ok=True)
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in (filename or "file"))
    # A short random part keeps a replacement from landing on the file it replaces.
    stored_path = f"{story_id}/{asset_id}_{uuid.uuid4().hex[:8]}_{safe_name}"
    (uploads_dir() / stored_path).write_bytes(contents)
    return stored_path


def read_bytes(asset: StoryAsset) -> bytes:
    path = uploads_dir() / asset.stored_path
    return path.read_bytes() if asset.stored_path and path.is_file() else b""


def give_own_file(src: StoryAsset, dst: StoryAsset) -> None:
    """``dst``, a copy of ``src`` in another book, gets a file of its own with the same bytes."""
    dst.stored_path = write_upload(dst.story_id, dst.id, src.original_filename, read_bytes(src))


def copy_asset(db: Session, src: StoryAsset, story_id: str) -> StoryAsset:
    """A copy of ``src`` in another book: its own row and its own file."""
    data = {
        attr.key: getattr(src, attr.key)
        for attr in sa_inspect(StoryAsset).mapper.column_attrs
        if attr.key not in ("id", "story_id", "stored_path", "created_at", "updated_at")
    }
    copy = StoryAsset(id=str(uuid.uuid4()), story_id=story_id, stored_path="", **data)
    give_own_file(src, copy)
    db.add(copy)
    db.flush()
    return copy
