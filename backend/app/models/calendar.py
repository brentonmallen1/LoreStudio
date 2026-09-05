import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .story import Story



class Calendar(Base):
    """An in-world calendar system."""

    __tablename__ = "calendars"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    months: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"name": "...", "days": 30}]
    days_per_week: Mapped[int] = mapped_column(Integer, default=7)
    week_day_names: Mapped[list] = mapped_column(JSON, default=list)
    # Format: ["Moonday", "Fireday", ...]
    special_days: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"name": "...", "month": 3, "day": 15, "description": "..."}]
    epoch_name: Mapped[str] = mapped_column(String, default="")  # "Year of Light", "After the Sundering"
    conversion_notes: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="calendars")
