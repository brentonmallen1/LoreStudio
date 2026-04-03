import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class CharacterJourneySummary(Base):
    __tablename__ = "character_journey_summaries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(
        String, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    up_to_node_id: Mapped[str] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="CASCADE"), nullable=False
    )
    # First-person narrative of what the character has experienced up to this point
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # Comma-separated node IDs whose summaries were used to build this journey
    source_node_ids: Mapped[str] = mapped_column(Text, default="", server_default="")
    # True when any source scene summary has been regenerated since this was built
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    character: Mapped["Character"] = relationship("Character", backref="journey_summaries")
    up_to_node: Mapped["StructureNode"] = relationship("StructureNode")
