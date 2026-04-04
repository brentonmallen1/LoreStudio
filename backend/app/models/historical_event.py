import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Era(Base):
    """A named historical period in the story world."""

    __tablename__ = "eras"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[str] = mapped_column(String, default="")  # Flexible in-world date format
    end_date: Mapped[str] = mapped_column(String, default="")
    characteristics: Mapped[str] = mapped_column(Text, default="")
    key_figures: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"name": "...", "role": "..."}]
    position: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="eras")
    events: Mapped[list["HistoricalEvent"]] = relationship(
        "HistoricalEvent", back_populates="era", cascade="all, delete-orphan"
    )


class HistoricalEvent(Base):
    """A named event in the story world's history."""

    __tablename__ = "historical_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    era_id: Mapped[str | None] = mapped_column(String, ForeignKey("eras.id"), nullable=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    in_world_date: Mapped[str] = mapped_column(String, default="")  # Flexible format
    participants: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"type": "character"|"culture", "id": "...", "name": "...", "role": "..."}]
    causes: Mapped[str] = mapped_column(Text, default="")
    consequences: Mapped[str] = mapped_column(Text, default="")
    legacy_effects: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="historical_events")
    era: Mapped["Era | None"] = relationship("Era", back_populates="events")
