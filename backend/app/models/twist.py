import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
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

    #: Palette slot 1..8, like a thread's; a new twist starts on teal (doc 18 D2).
    color_slot: Mapped[int] = mapped_column(Integer, default=7)

    revealed_at_node_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True)

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
    clues: Mapped[list["TwistClue"]] = relationship(
        "TwistClue", back_populates="twist", cascade="all, delete-orphan", order_by="TwistClue.position"
    )

    @property
    def status(self) -> str:
        """planned, seeding (a clue is placed in a scene) or revealed (it has a reveal scene)."""
        if self.revealed_at_node_id:
            return "revealed"
        return "seeding" if any(c.node_id for c in self.clues) else "planned"


class TwistClue(Base):
    """A clue toward a twist's truth, or away from it, planted in a scene (doc 18 C1)."""

    __tablename__ = "twist_clues"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    twist_id: Mapped[str] = mapped_column(String, ForeignKey("twists.id"), nullable=False, index=True)
    node_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True, index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    points_to: Mapped[str] = mapped_column(String, default="truth")  # truth | misdirection
    subtlety: Mapped[str] = mapped_column(String, default="moderate")  # obvious | moderate | subtle | hidden
    #: The words in the scene the clue is, when it was planted from a selection.
    quote: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    twist: Mapped["Twist"] = relationship("Twist", back_populates="clues")
    node: Mapped["StructureNode | None"] = relationship("StructureNode", back_populates="twist_clues")
