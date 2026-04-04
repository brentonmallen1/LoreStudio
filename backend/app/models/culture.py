import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Culture(Base):
    """A culture or society in the story world."""

    __tablename__ = "cultures"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    values: Mapped[str] = mapped_column(Text, default="")
    customs: Mapped[str] = mapped_column(Text, default="")
    taboos: Mapped[str] = mapped_column(Text, default="")
    religion: Mapped[str] = mapped_column(Text, default="")
    government_type: Mapped[str] = mapped_column(String, default="")
    economy: Mapped[str] = mapped_column(Text, default="")
    social_hierarchy: Mapped[str] = mapped_column(Text, default="")
    naming_conventions: Mapped[dict] = mapped_column(JSON, default=dict)
    # Format: {"given_name": "...", "family_name": "...", "titles": [...], "examples": [...]}
    common_phrases: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"phrase": "...", "meaning": "...", "context": "..."}]
    notes: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="cultures")
