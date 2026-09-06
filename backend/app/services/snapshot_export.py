"""
Snapshot export and import: one story, one zip.

Split out of snapshot_service.py, which was over its size budget — this half only deals in
files, and nothing else in the service needs it.
"""

import io
import json
import zipfile
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.snapshot import StorySnapshot
from .snapshot_service import (
    APP_VERSION,
    FORMAT_VERSION,
    _snapshot_file_path,
    resolve_snapshot_data,
)


def _build_zip_bytes(snapshot: StorySnapshot, db: Session) -> bytes:
    """Build the raw zip archive bytes for a snapshot (always recomputes)."""
    state = resolve_snapshot_data(snapshot, db)
    story_meta = state.get("story", {})

    manifest = {
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "app_version": APP_VERSION,
        "snapshot_id": snapshot.id,
        "story_id": snapshot.story_id,
        "story_title": story_meta.get("title", ""),
        "snapshot_name": snapshot.name,
        "snapshot_created_at": snapshot.created_at.isoformat(),
        "includes": {
            "diagrams": "diagrams" in state,
            "interviews": "interviews" in state or "panel_interviews" in state,
            "chat_sessions": "chat_sessions" in state,
            "activity_logs": "activity_logs" in state,
            "media_assets": "media_assets" in state,
        },
        "stats": snapshot.summary or {},
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))
        zf.writestr("story.json", json.dumps(state, indent=2, default=str))

    return buf.getvalue()


def export_snapshot(snapshot: StorySnapshot, db: Session) -> bytes:
    """Return the .lorestudio.zip bytes for the given snapshot.

    Reads from disk if the archive already exists; otherwise computes and
    persists it so subsequent downloads are instant.
    """
    disk_path = _snapshot_file_path(snapshot.story_id, snapshot.id)
    if disk_path.exists():
        return disk_path.read_bytes()

    zip_bytes = _build_zip_bytes(snapshot, db)
    disk_path.parent.mkdir(parents=True, exist_ok=True)
    disk_path.write_bytes(zip_bytes)
    return zip_bytes


def import_snapshot_file(file_bytes: bytes) -> dict:
    """
    Parse an uploaded .lorestudio.zip file.
    Returns {"manifest": {...}, "state": {...}}.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            manifest = json.loads(zf.read("manifest.json"))
            state = json.loads(zf.read("story.json"))
    except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid .lorestudio.zip file: {exc}")

    if manifest.get("format_version") != FORMAT_VERSION:
        raise ValueError(f"Unsupported format version: {manifest.get('format_version')}")

    return {"manifest": manifest, "state": state}
