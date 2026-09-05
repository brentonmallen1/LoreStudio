import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story
    from .structure import StructureNode
    from .twist import Twist


class ReaderKnowledgeEvent(Base):
    __tablename__ = "reader_knowledge_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    # When in the story this knowledge state exists
    node_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True)

    # Optional link to a twist
    twist_id: Mapped[str | None] = mapped_column(String, ForeignKey("twists.id"), nullable=True)

    # What kind of information transfer is this?
    # "truth_revealed" | "misdirection_planted" | "clue_planted" | "character_learns" | "reader_only"
    knowledge_type: Mapped[str] = mapped_column(String, nullable=False, default="truth_revealed")

    subject: Mapped[str] = mapped_column(String, nullable=False)  # Brief label
    detail: Mapped[str] = mapped_column(Text, default="")  # Full description

    reader_knows: Mapped[bool] = mapped_column(Boolean, default=True)  # Does reader know at this point?
    characters_who_know: Mapped[list] = mapped_column(JSON, default=list, nullable=True)  # character IDs
    is_truth: Mapped[bool] = mapped_column(Boolean, default=True)  # True = factual, False = misdirection

    # When this event supersedes/corrects an earlier one (e.g. truth revealed after misdirection)
    supersedes_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="reader_knowledge_events")
    node: Mapped["StructureNode | None"] = relationship(
        "StructureNode", foreign_keys=[node_id], back_populates="reader_knowledge_events"
    )
    twist: Mapped["Twist | None"] = relationship(
        "Twist", foreign_keys=[twist_id], back_populates="reader_knowledge_events"
    )
