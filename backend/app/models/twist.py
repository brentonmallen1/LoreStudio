import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .reader_knowledge import ReaderKnowledgeEvent
    from .story import Story
    from .structure import StructureNode


class Twist(Base):
    __tablename__ = "twists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    # The core duality
    the_truth: Mapped[str] = mapped_column(Text, default="")
    the_misdirection: Mapped[str] = mapped_column(Text, default="")

    twist_type: Mapped[str] = mapped_column(String, default="reveal")
    # reveal | reversal | identity | unreliable_narrator | red_herring

    status: Mapped[str] = mapped_column(String, default="planned")
    # planned | seeding | revealed

    revealed_at_node_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True)

    # Clues as JSON array, following try_fail_cycles pattern
    # [{id, node_id, text, points_to: "truth"|"misdirection", subtlety: "obvious"|"moderate"|"subtle"|"hidden"}]
    clues: Mapped[list] = mapped_column(JSON, default=list, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="twists")
    revealed_at_node: Mapped["StructureNode | None"] = relationship(
        "StructureNode", foreign_keys=[revealed_at_node_id], back_populates="twists_revealed"
    )
    reader_knowledge_events: Mapped[list["ReaderKnowledgeEvent"]] = relationship(
        "ReaderKnowledgeEvent", foreign_keys="ReaderKnowledgeEvent.twist_id", back_populates="twist"
    )  # nulled on delete
