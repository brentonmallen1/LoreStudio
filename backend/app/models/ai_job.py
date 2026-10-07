import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class AIJob(Base):
    """
    Work too long to hold a request open for, AI or local (refactor doc 06 §8, doc 21).

    Summarising every scene in a manuscript, or running a whole-story analysis, took
    minutes with the browser waiting on it and no way to see progress or stop. A job is
    the record of that work: what was asked for, how far it got, and what came of it.

    The queue is the table itself rather than an in-memory list, so a job that was running
    when the server stopped is visible afterwards instead of vanishing.
    """

    __tablename__ = "ai_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=True, index=True
    )

    #: Which handler runs this job (services/job_queue.JOB_HANDLERS).
    kind: Mapped[str] = mapped_column(String, nullable=False)
    #: What the author sees in the jobs list.
    label: Mapped[str] = mapped_column(String, default="")
    #: queued | running | done | error | cancelled
    status: Mapped[str] = mapped_column(String, default="queued", index=True)

    #: Handler arguments, as given at enqueue time.
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    #: Whatever the handler wants to report back — counts, an activity log id.
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    progress: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    #: Set by the author; the handler stops at its next step.
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)

    #: model | local (doc 21 P2): which worker runs it. One model call at a time; local work
    #: never waits behind the model.
    lane: Mapped[str] = mapped_column(String, default="model", server_default="model")
    #: Order within the lane, lowest first. Run next puts a job below the rest.
    position: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    #: author | auto: who started it, and for automatic work a phrase saying when.
    origin: Mapped[str] = mapped_column(String, default="author", server_default="author")
    origin_note: Mapped[str | None] = mapped_column(String, nullable=True)
    #: Automatic work that never toasts (a reading, a sync after an edit).
    quiet: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    #: What it is doing now ("Reading chapter 3"), or why it is waiting.
    step_label: Mapped[str | None] = mapped_column(String, nullable=True)
    #: When the author's Jobs list showed it finished; until then it is unseen.
    seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    #: The job this one runs again.
    retry_of: Mapped[str | None] = mapped_column(String, nullable=True)
    #: Times a restart interrupted it; the first requeues it, the second fails it (D11).
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    story: Mapped["Story | None"] = relationship("Story", back_populates="ai_jobs")

    @property
    def story_title(self) -> str | None:
        return self.story.title if self.story else None

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
