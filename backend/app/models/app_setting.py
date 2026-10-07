"""App-wide settings (doc 22): what belongs to this LoreStudio rather than to one author."""

from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AppSetting(Base):
    """
    One JSON value per key. The first is "automatic" (Settings › Automatic work: which of the
    work LoreStudio does by itself runs, and how often) and its record of each task's last run,
    "automatic_state". An author's own preferences stay on `User.settings`.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )
