import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .character import Character
    from .structure import StructureNode


class CharacterJourneySummary(Base):
    __tablename__ = "character_journey_summaries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(
        String, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    up_to_node_id: Mapped[str] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # First-person narrative of what the character has experienced up to this point
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # Comma-separated node IDs whose summaries were used to build this journey
    source_node_ids: Mapped[str] = mapped_column(Text, default="", server_default="")
    # True when any source scene summary has been regenerated since this was built
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    character: Mapped["Character"] = relationship("Character", back_populates="journey_summaries")
    up_to_node: Mapped["StructureNode"] = relationship("StructureNode", back_populates="journey_summaries")
