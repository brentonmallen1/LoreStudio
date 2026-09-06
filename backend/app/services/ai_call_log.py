"""
Reading and retention for the AI call log (refactor doc 06 §3).

Every call the gateway makes leaves two rows: a summary in `activity_logs` and the prose
in `ai_call_payloads`. The summary is the permanent record — it is what makes the claim
"nothing happens behind your back" checkable. The payload is the evidence, and it is the
expensive half, so it has its own retention window and a purge the author controls.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.ai_call import AICallPayload

logger = logging.getLogger(__name__)


def get_call(db: Session, log_id: str, user_id: str) -> tuple[ActivityLog, AICallPayload | None] | None:
    """The activity row and its payload, or None when the id is not this user's AI call."""
    log = db.get(ActivityLog, log_id)
    if not log or log.user_id != user_id or log.category != "ai":
        return None
    payload = db.query(AICallPayload).filter(AICallPayload.activity_log_id == log_id).one_or_none()
    return log, payload


def prune_payloads(db: Session, days: int) -> int:
    """
    Drop payloads older than `days`; the summary rows stay. 0 or less keeps everything.
    """
    if days <= 0:
        return 0
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
    removed = db.query(AICallPayload).filter(AICallPayload.created_at < cutoff).delete(synchronize_session=False)
    if removed:
        db.commit()
    return removed


def purge_payloads(db: Session, user_id: str) -> int:
    """Delete every stored payload for one user, on request (Settings › Privacy)."""
    log_ids = [row[0] for row in db.query(ActivityLog.id).filter(ActivityLog.user_id == user_id).all()]
    if not log_ids:
        return 0
    removed = 0
    for i in range(0, len(log_ids), 500):  # SQLite caps the number of bound parameters
        removed += (
            db.query(AICallPayload)
            .filter(AICallPayload.activity_log_id.in_(log_ids[i : i + 500]))
            .delete(synchronize_session=False)
        )
    db.commit()
    return removed
