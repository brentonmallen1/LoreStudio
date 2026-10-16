import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint, delete, event
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class AssistantResult(Base):
    """A one-shot Assistant answer kept on the sheet it was asked from (A6).

    One per thing and feature: asking again replaces it, Clear deletes it. The subject is a
    row of any Lorebook or Promises kind (``subject_type`` / ``subject_id``, no foreign key,
    the ``Note.about_id`` pattern), a scene or section, an image, an outline, or the story
    itself (``subject_type`` "story", ``subject_id`` its id); the listener below drops the
    answers of a row that is deleted, and the story's go with it. It is an AI answer, not
    story data: undo and snapshots leave it be.
    """

    __tablename__ = "assistant_results"
    __table_args__ = (
        UniqueConstraint("story_id", "subject_type", "subject_id", "feature", name="uq_assistant_result"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_type: Mapped[str] = mapped_column(String, nullable=False)
    subject_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    #: The gateway feature id (services/llm/features.py), or "element-suggest:culture" style
    #: when one feature answers in two shapes.
    feature: Mapped[str] = mapped_column(String, nullable=False)
    heading: Mapped[str] = mapped_column(String, nullable=False, default="")
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    #: The ActivityLog row of the call that made it, for "what was sent" (no foreign key: the
    #: log has its own retention).
    ai_call_log_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="assistant_results")


#: The rows an answer can be about, by table, and the subject type the client names them by.
SUBJECT_TYPE_BY_TABLE = {
    "characters": "character",
    "locations": "location",
    "cultures": "culture",
    "world_systems": "world_system",
    "historical_events": "historical_event",
    "calendars": "calendar",
    "location_travel": "location_travel",
    "plot_threads": "plot_thread",
    "twists": "twist",
    # A7: the answers that are about a scene or section, an image, or an outline.
    "structure_nodes": "node",
    "story_assets": "image",
    "outlines": "outline",
}

#: Every subject type: a row of one of the tables above, or the story as a whole.
SUBJECT_TYPES = frozenset({*SUBJECT_TYPE_BY_TABLE.values(), "story"})


@event.listens_for(Session, "after_flush")
def _drop_answers_of_deleted_rows(session: Session, _ctx) -> None:
    """A deleted character, place, scene or image takes its kept answers with it."""
    gone: dict[str, list[str]] = {}
    for obj in session.deleted:
        subject_type = SUBJECT_TYPE_BY_TABLE.get(getattr(obj, "__tablename__", ""))
        if subject_type and getattr(obj, "id", None):
            gone.setdefault(subject_type, []).append(obj.id)
    for subject_type, ids in gone.items():
        session.connection().execute(
            delete(AssistantResult).where(
                AssistantResult.subject_type == subject_type,
                AssistantResult.subject_id.in_(ids),
            )
        )
