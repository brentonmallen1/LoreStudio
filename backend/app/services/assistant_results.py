"""Kept Assistant answers (A6): a one-shot answer stays on the sheet it was asked from.

`keep` is what a route calls with its gateway result: a good answer replaces the subject's
last one for that feature, a failed one leaves it alone. `for_subject` reads them back and
`clear` deletes one. They are AI answers, not story data, so nothing here records an undo;
running the feature again brings one back.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.assistant_result import SUBJECT_TYPE_BY_TABLE, AssistantResult
from ..schemas.ai_responses import StructuredResult
from .llm.features import FEATURES_BY_ID
from .llm.gateway import AICallContext

SUBJECT_TYPES = frozenset(SUBJECT_TYPE_BY_TABLE.values())


def save(
    db: Session,
    *,
    story_id: str,
    subject_type: str,
    subject_id: str,
    feature: str,
    data: dict,
    heading: str = "",
    ai_call_log_id: str | None = None,
) -> AssistantResult:
    """Keep an answer, replacing the one this subject had for this feature."""
    row = (
        db.query(AssistantResult)
        .filter_by(story_id=story_id, subject_type=subject_type, subject_id=subject_id, feature=feature)
        .first()
    )
    if row is None:
        row = AssistantResult(story_id=story_id, subject_type=subject_type, subject_id=subject_id, feature=feature)
        db.add(row)
    row.heading = heading or (FEATURES_BY_ID[feature].label if feature in FEATURES_BY_ID else feature)
    row.data = data
    row.ai_call_log_id = ai_call_log_id
    row.updated_at = datetime.now(UTC)
    db.commit()
    return row


def keep(
    db: Session,
    result: StructuredResult,
    ctx: AICallContext,
    *,
    subject_type: str,
    subject_id: str,
    heading: str = "",
) -> StructuredResult:
    """A route's last step: keep a good answer on its subject, then return it as it came."""
    if result.success and result.data is not None and ctx.story_id:
        save(
            db,
            story_id=ctx.story_id,
            subject_type=subject_type,
            subject_id=subject_id,
            feature=ctx.feature,
            data=result.data,
            heading=heading,
            ai_call_log_id=ctx.log_id,
        )
    return result


def for_subject(db: Session, story_id: str, subject_type: str, subject_id: str) -> list[AssistantResult]:
    """A subject's kept answers, the newest first."""
    return (
        db.query(AssistantResult)
        .filter_by(story_id=story_id, subject_type=subject_type, subject_id=subject_id)
        .order_by(AssistantResult.updated_at.desc())
        .all()
    )


def clear(db: Session, story_id: str, result_id: str) -> bool:
    """Delete one kept answer; False when this story has no such answer."""
    row = db.query(AssistantResult).filter_by(id=result_id, story_id=story_id).first()
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
