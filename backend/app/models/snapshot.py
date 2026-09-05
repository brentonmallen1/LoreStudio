import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story
    from .user import User


class StorySnapshot(Base):
    __tablename__ = "story_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    trigger: Mapped[str] = mapped_column(String, default="manual")  # "manual" | "auto"
    snapshot_type: Mapped[str] = mapped_column(String, default="full")  # "full" | "delta"
    base_snapshot_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("story_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    delta_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    story: Mapped["Story"] = relationship("Story", back_populates="snapshots")
    base_snapshot: Mapped["StorySnapshot | None"] = relationship(
        "StorySnapshot", remote_side="StorySnapshot.id", foreign_keys=[base_snapshot_id]
    )


class StoryBackupSettings(Base):
    __tablename__ = "story_backup_settings"
    __table_args__ = (UniqueConstraint("story_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    auto_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    max_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=30)
    max_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_auto_backup_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    include_diagrams: Mapped[bool] = mapped_column(Boolean, default=True)
    include_interviews: Mapped[bool] = mapped_column(Boolean, default=True)
    include_chat_sessions: Mapped[bool] = mapped_column(Boolean, default=True)
    include_activity_logs: Mapped[bool] = mapped_column(Boolean, default=True)
    activity_log_limit: Mapped[int | None] = mapped_column(Integer, nullable=True, default=500)
    include_media_assets: Mapped[bool] = mapped_column(Boolean, default=True)

    story: Mapped["Story"] = relationship("Story", back_populates="backup_settings", uselist=False)


class UserBackupDefaults(Base):
    __tablename__ = "user_backup_defaults"
    __table_args__ = (UniqueConstraint("user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    auto_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    max_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=30)
    max_age_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    include_diagrams: Mapped[bool] = mapped_column(Boolean, default=True)
    include_interviews: Mapped[bool] = mapped_column(Boolean, default=True)
    include_chat_sessions: Mapped[bool] = mapped_column(Boolean, default=True)
    include_activity_logs: Mapped[bool] = mapped_column(Boolean, default=True)
    activity_log_limit: Mapped[int | None] = mapped_column(Integer, nullable=True, default=500)
    include_media_assets: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship("User", back_populates="backup_defaults", uselist=False)
