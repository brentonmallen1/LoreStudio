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

from ..models.numbers_reading import NumbersReading
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
    persists it so subsequent downloads are instant. The Numbers readings up to this version
    (doc 19, D3) are added on the way out: the cached archive was written before the version's
    own reading was taken.
    """
    disk_path = _snapshot_file_path(snapshot.story_id, snapshot.id)
    if disk_path.exists():
        zip_bytes = disk_path.read_bytes()
    else:
        zip_bytes = _build_zip_bytes(snapshot, db)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        disk_path.write_bytes(zip_bytes)
    return _with_readings(zip_bytes, _readings_up_to(snapshot, db))


READINGS_FILE = "numbers_readings.json"


def _readings_up_to(snapshot: StorySnapshot, db: Session) -> list[dict]:
    """The story's readings taken by this version, its own included: the history it carries."""
    created = snapshot.created_at.replace(tzinfo=None) if snapshot.created_at.tzinfo else snapshot.created_at
    rows = (
        db.query(NumbersReading)
        .filter(NumbersReading.story_id == snapshot.story_id)
        .order_by(NumbersReading.taken_at.asc())
        .all()
    )
    return [
        {
            "taken_at": r.taken_at.isoformat(),
            "trigger": r.trigger,
            "label": r.label,
            "version": r.version,
            "data": r.data,
        }
        for r in rows
        if r.snapshot_id == snapshot.id or r.taken_at <= created
    ]


def _with_readings(zip_bytes: bytes, readings: list[dict]) -> bytes:
    """The archive with its readings file replaced by `readings`."""
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as src, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            if item.filename != READINGS_FILE:
                dst.writestr(item, src.read(item.filename))
        dst.writestr(READINGS_FILE, json.dumps(readings, default=str))
    return out.getvalue()


def import_snapshot_file(file_bytes: bytes) -> dict:
    """
    Parse an uploaded .lorestudio.zip file.
    Returns {"manifest": {...}, "state": {...}}.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            manifest = json.loads(zf.read("manifest.json"))
            state = json.loads(zf.read("story.json"))
            names = set(zf.namelist())
            readings = json.loads(zf.read(READINGS_FILE)) if READINGS_FILE in names else []
    except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid .lorestudio.zip file: {exc}")

    if manifest.get("format_version") != FORMAT_VERSION:
        raise ValueError(f"Unsupported format version: {manifest.get('format_version')}")

    return {"manifest": manifest, "state": state, "readings": readings}
