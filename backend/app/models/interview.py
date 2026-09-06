import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .character import Character


class CharacterInterview(Base):
    __tablename__ = "character_interviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, default="")
    context_node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="SET NULL"), nullable=True, default=None
    )
    #: How much of the story this character may draw on (doc 06 §6):
    #:   "profile"    — outside the story: they know themselves, not the plot
    #:   "present"    — every scene they were present for, across the manuscript
    #:   "as_of"      — the same, stopping at context_node_id
    #:   "omniscient" — the whole manuscript, scenes they were not in included, as a
    #:                  hypothetical the author is posing
    knowledge_scope: Mapped[str] = mapped_column(String, default="profile", server_default="profile")
    messages: Mapped[list] = mapped_column(JSON, default=list)
    # messages format: [{"role": "user"|"assistant", "content": str, "timestamp": str}]
    interview_notes: Mapped[str] = mapped_column(Text, default="")  # Captured insights summary
    compacted_summary: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    compaction_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    character: Mapped["Character"] = relationship("Character", back_populates="interviews")
