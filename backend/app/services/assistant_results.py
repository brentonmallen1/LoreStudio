"""Kept Assistant answers (A6, A7): a one-shot answer stays where it was asked for.

`keep` is what a route calls with its gateway result: a good answer replaces the subject's
last one for that feature, a failed one leaves it alone. A streamed answer is kept by
`keep_text`, passed as the stream's `on_complete`, which the gateway calls only when the
stream finished well. `for_subject` reads them back and `clear` deletes one. They are AI
answers, not story data, so nothing here records an undo; running the feature again brings
one back.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from ..models.assistant_result import SUBJECT_TYPES, AssistantResult
from ..schemas.ai_responses import StructuredResult
from .llm.features import FEATURES_BY_ID
from .llm.gateway import AICallContext

if TYPE_CHECKING:  # pragma: no cover
    from .llm.gateway import AICallResult

__all__ = ["SUBJECT_TYPES", "clear", "for_subject", "keep", "keep_text", "passage_subject", "save"]


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
    base = feature.split(":", 1)[0]
    row.heading = heading or (FEATURES_BY_ID[base].label if base in FEATURES_BY_ID else feature)
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
    feature: str = "",
    extra: dict | None = None,
) -> StructuredResult:
    """A route's last step: keep a good answer on its subject, then return it as it came.

    `feature` names it when one feature answers several questions about one thing (a Plan
    step's layer); `extra` is kept beside the answer: what was asked about (a passage).
    """
    if result.success and result.data is not None and ctx.story_id:
        save(
            db,
            story_id=ctx.story_id,
            subject_type=subject_type,
            subject_id=subject_id,
            feature=feature or ctx.feature,
            data={**result.data, **(extra or {})},
            heading=heading,
            ai_call_log_id=ctx.log_id,
        )
    return result


def keep_text(
    db: Session,
    ctx: AICallContext,
    subject_type: str,
    subject_id: str,
    *,
    feature: str = "",
    heading: str = "",
    extra: dict | None = None,
) -> Callable[["AICallResult"], Awaitable[None]]:
    """A stream's `on_complete`: keep its finished prose as `{"text": …}` on the subject.

    The gateway calls it only for a stream that ended well with something said, so a failed
    or stopped one leaves the last kept answer alone.
    """

    async def on_complete(result: "AICallResult") -> None:
        if ctx.story_id and result.content.strip():
            save(
                db,
                story_id=ctx.story_id,
                subject_type=subject_type,
                subject_id=subject_id,
                feature=feature or ctx.feature,
                data={"text": result.content.strip(), **(extra or {})},
                heading=heading,
                ai_call_log_id=ctx.log_id,
            )

    return on_complete


def passage_subject(story_id: str, node_id: str | None, text: str | None) -> dict:
    """Where a reading of prose is kept: on its scene, or on the story for a passage with no
    scene; the passage itself goes with it, so a page can tell whether it is the one asked."""
    subject = ("node", node_id) if node_id else ("story", story_id)
    return {"subject_type": subject[0], "subject_id": subject[1], "extra": {"passage": (text or "").strip()}}


def for_subject(db: Session, story_id: str, subject_type: str, subject_id: str | None = None) -> list[AssistantResult]:
    """A subject's kept answers, the newest first; with no id, every one of that type (the
    images in the Compendium, read at once)."""
    query = db.query(AssistantResult).filter_by(story_id=story_id, subject_type=subject_type)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    return query.order_by(AssistantResult.updated_at.desc()).all()


def clear(db: Session, story_id: str, result_id: str) -> bool:
    """Delete one kept answer; False when this story has no such answer."""
    row = db.query(AssistantResult).filter_by(id=result_id, story_id=story_id).first()
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
