"""
When readings are taken and how long they are kept (doc 19, D1–D2).

Automatic, so the author never has to remember: a reading when a writing session starts (the
story opened after three hours away), at most one more a day if the book changed, one with
every version (a named snapshot) and one after a restore. By hand: Measure now. All of it runs
after the request has answered, so saving and walking away never waits on a measurement.

Thinning keeps every reading for two weeks, then the last of each day to ninety days, then the
last of each week. A reading taken with a version is never thinned.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Connection, Engine
from sqlalchemy.orm import Session

from ..models.numbers_reading import NumbersReading
from ..models.snapshot import StorySnapshot
from ..models.story import Story
from .numbers_reading import READING_VERSION, measure_now, measure_snapshot
from .snapshot_service import _get_or_create_settings, resolve_snapshot_data

logger = logging.getLogger(__name__)

#: Away this long, and opening the story again starts a session (D1).
SESSION_GAP = timedelta(hours=3)
#: How often an open story is checked for its daily reading.
DAILY_CHECK = timedelta(minutes=30)
#: Every reading is kept this long; then one a day until KEEP_DAILY; then one a week.
KEEP_ALL = timedelta(days=14)
KEEP_DAILY = timedelta(days=90)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _naive(at: datetime) -> datetime:
    return at.replace(tzinfo=None) if at.tzinfo else at


def latest(story_id: str, db: Session) -> NumbersReading | None:
    return (
        db.query(NumbersReading)
        .filter(NumbersReading.story_id == story_id)
        .order_by(NumbersReading.taken_at.desc())
        .first()
    )


def record(
    story_id: str,
    db: Session,
    *,
    trigger: str,
    label: str | None = None,
    snapshot_id: str | None = None,
    only_if_changed: bool = False,
) -> NumbersReading | None:
    """Measure the story now and keep it. `only_if_changed` skips a reading equal to the last."""
    story = db.get(Story, story_id)
    if story is None:
        return None
    data = measure_now(story, db)
    if only_if_changed:
        last = latest(story_id, db)
        if last is not None and last.data == data:
            return None
    reading = NumbersReading(
        story_id=story_id,
        taken_at=_now(),
        trigger=trigger,
        label=label,
        snapshot_id=snapshot_id,
        version=READING_VERSION,
        data=data,
    )
    db.add(reading)
    db.flush()
    thin(story_id, db)
    db.commit()
    return reading


def visit(story_id: str, db: Session) -> str | None:
    """The story is open (the workspace calls this on load and every five minutes): which
    reading, if any, this visit calls for. Moves the clock either way."""
    settings = _get_or_create_settings(story_id, db)
    now = _now()
    seen = settings.numbers_seen_at
    settings.numbers_seen_at = now
    if seen is None or now - _naive(seen) >= SESSION_GAP:
        settings.numbers_checked_at = now
        db.commit()
        return "session"
    checked = settings.numbers_checked_at
    if checked is not None and now - _naive(checked) < DAILY_CHECK:
        db.commit()
        return None
    settings.numbers_checked_at = now
    db.commit()
    last = latest(story_id, db)
    if last is not None and _naive(last.taken_at).date() == now.date():
        return None
    return "daily"


def thin(story_id: str, db: Session, now: datetime | None = None) -> int:
    """Drop the readings the schedule no longer keeps. Versions are kept whatever their age."""
    now = now or _now()
    readings = (
        db.query(NumbersReading)
        .filter(NumbersReading.story_id == story_id)
        .order_by(NumbersReading.taken_at.desc())
        .all()
    )
    kept: set[tuple[str, Any]] = set()
    dropped = 0
    for r in readings:  # newest first: the first seen in a day or week is its last
        at = _naive(r.taken_at)
        age = now - at
        if r.label or r.snapshot_id or age < KEEP_ALL:
            continue
        bucket = ("day", at.date()) if age < KEEP_DAILY else ("week", tuple(at.isocalendar())[:2])
        if bucket in kept:
            db.delete(r)
            dropped += 1
        else:
            kept.add(bucket)
    return dropped


def unmeasured_snapshots(story_id: str, db: Session) -> list[StorySnapshot]:
    """Versions with no reading yet, newest first: what a backfill measures."""
    measured = {
        sid
        for (sid,) in db.query(NumbersReading.snapshot_id).filter(
            NumbersReading.story_id == story_id, NumbersReading.snapshot_id.isnot(None)
        )
    }
    snaps = (
        db.query(StorySnapshot)
        .filter(StorySnapshot.story_id == story_id)
        .order_by(StorySnapshot.created_at.desc())
        .all()
    )
    return [s for s in snaps if s.id not in measured]


def measure_version(story: Story, snap: StorySnapshot, db: Session) -> bool:
    """Measure one earlier version and keep its reading, at the version's own time."""
    try:
        data = measure_snapshot(story, resolve_snapshot_data(snap, db), _naive(snap.created_at), db)
    except Exception:  # one unreadable version must not stop the rest
        logger.exception("could not measure snapshot %s", snap.id)
        return False
    db.add(
        NumbersReading(
            story_id=story.id,
            taken_at=_naive(snap.created_at),
            trigger="backfill",
            label=snap.name,
            snapshot_id=snap.id,
            version=READING_VERSION,
            data=data,
        )
    )
    db.commit()
    return True


def backfill(story_id: str, db: Session) -> dict[str, int]:
    """Measure every earlier version that has no reading, newest first (the job runs the same
    steps, yielding between versions; this is the whole of it at once, for tests and scripts)."""
    story = db.get(Story, story_id)
    todo = unmeasured_snapshots(story_id, db) if story else []
    done = sum(measure_version(story, snap, db) for snap in todo) if story else 0
    thin(story_id, db)
    db.commit()
    return {"measured": done, "of": len(todo)}


def in_background(engine: Engine | Connection, story_id: str, **kwargs: Any) -> None:
    """`record`, in a session of its own, for a FastAPI background task: the request has
    already answered. A failure is logged, never raised: the author did not ask to wait."""
    try:
        with Session(engine) as db:
            record(story_id, db, **kwargs)
    except Exception:
        logger.exception("numbers reading for %s failed", story_id)


def adopt(story_id: str, readings: list[dict[str, Any]], db: Session) -> int:
    """Readings from an imported archive (D3), as this story's. Their versions did not come
    with them, so they keep their names but link to none; one already here is not doubled."""
    have = {
        (_naive(r.taken_at), r.trigger) for r in db.query(NumbersReading).filter(NumbersReading.story_id == story_id)
    }
    added = 0
    for item in readings:
        try:
            at = _naive(datetime.fromisoformat(item["taken_at"]))
        except (KeyError, TypeError, ValueError):
            continue
        if (at, item.get("trigger")) in have or not isinstance(item.get("data"), dict):
            continue
        db.add(
            NumbersReading(
                story_id=story_id,
                taken_at=at,
                trigger=item.get("trigger") or "manual",
                label=item.get("label"),
                version=item.get("version") or 1,
                data=item["data"],
            )
        )
        added += 1
    return added
