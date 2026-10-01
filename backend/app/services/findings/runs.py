"""The latest run of every check, read from the Chronicle (doc 12 P3).

Each analysis already writes an ``analysis_run`` (or ``editorial_pass``) entry holding its
whole result. Findings are read from the newest entry per feature, so a new run replaces
the last one's findings, a restored snapshot brings its findings back with its log, and
nothing is copied into a second table that could disagree with the first.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from ...models.activity_log import ActivityLog

RUN_EVENTS = ("analysis_run", "editorial_pass")


def latest_runs(story_id: str, db: Session) -> dict[str, ActivityLog]:
    feature = ActivityLog.metadata_["feature"].as_string()
    newest = (
        db.query(feature.label("feature"), func.max(ActivityLog.created_at).label("at"))
        .filter(ActivityLog.story_id == story_id, ActivityLog.event_type.in_(RUN_EVENTS))
        .group_by(feature)
        .subquery()
    )
    rows = (
        db.query(ActivityLog)
        .join(newest, (feature == newest.c.feature) & (ActivityLog.created_at == newest.c.at))
        .filter(ActivityLog.story_id == story_id, ActivityLog.event_type.in_(RUN_EVENTS))
        .all()
    )
    out: dict[str, ActivityLog] = {}
    for log in rows:
        name = (log.metadata_ or {}).get("feature")
        if name and name not in out:
            out[name] = log
    return out


def result_of(log: ActivityLog) -> dict:
    """The run's own result: a ``StructuredResult`` keeps it under ``data`` (when the model
    answered in shape), local checks store it as is, the editorial pass is the metadata."""
    meta = log.metadata_ or {}
    if log.event_type == "editorial_pass":
        return meta
    result = meta.get("result") or {}
    if isinstance(result, dict) and "success" in result:
        return result.get("data") or {} if result.get("success") else {}
    return result if isinstance(result, dict) else {}
