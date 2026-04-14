import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("stories.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Classification
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    # e.g. "ai_chat", "ai_interview", "summary_generated", "analysis_run", "error"

    category: Mapped[str] = mapped_column(String, nullable=False)
    # e.g. "ai", "system", "task"

    description: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    # flexible extra data: model, tokens, session_id, node_id, error details, etc.

    starred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # starred summaries/analyses are surfaced in the Summary Archive tab of Chronicle

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
