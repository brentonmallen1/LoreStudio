import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

PREDEFINED_SYSTEM_TYPES = [
    "magic",
    "technology",
    "power",
    "social",
    "economic",
    "religious",
    "natural",
]


class WorldSystem(Base):
    """A defined system in the story world — magic, technology, powers, social structures, etc."""

    __tablename__ = "world_systems"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    system_type: Mapped[str] = mapped_column(String, default="")  # predefined or custom freeform
    source_origin: Mapped[str] = mapped_column(Text, default="")
    rules: Mapped[str] = mapped_column(Text, default="")
    limitations: Mapped[str] = mapped_column(Text, default="")
    costs: Mapped[str] = mapped_column(Text, default="")
    hierarchy_tiers: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"name": "Tier 1", "description": "...", "examples": [...]}]
    notes: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="world_systems")
