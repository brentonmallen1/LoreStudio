import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class CharacterInterview(Base):
    __tablename__ = "character_interviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, default="")
    context_node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="SET NULL"), nullable=True, default=None
    )
    messages: Mapped[list] = mapped_column(JSON, default=list)
    # messages format: [{"role": "user"|"assistant", "content": str, "timestamp": str}]
    interview_notes: Mapped[str] = mapped_column(Text, default="")  # Captured insights summary
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    character: Mapped["Character"] = relationship("Character", back_populates="interviews")
