import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story
    from .structure import StructureNode

#: What a note is (doc 15 D1). A question is settled by its answer; a to-do by ticking it.
NOTE_KINDS = ("note", "question", "todo", "idea")


class Note(Base):
    """A line the author wants to come back to (doc 15): one row whatever its kind.

    It is tied to a passage (node_id plus the quoted ``anchor``; the prose carries a
    ``<span data-note-id>`` with this row's id), a scene (node_id alone), a character or
    place (about_type / about_id, no foreign key, so deleting the character never fails on
    it), or nothing at all.
    """

    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String, default="note", server_default="note")
    content: Mapped[str] = mapped_column(Text, nullable=False)

    node_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True, index=True)
    #: The passage a margin note sits beside, as it read when the note was made.
    anchor: Mapped[str | None] = mapped_column(Text, nullable=True)
    about_type: Mapped[str | None] = mapped_column(String, nullable=True)
    about_id: Mapped[str | None] = mapped_column(String, nullable=True)

    #: A question's answer; done means answered (a question) or ticked (a to-do).
    answer: Mapped[str] = mapped_column(Text, default="", server_default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)

    #: Who wrote it, when not the author: "editorial-{report_id}" for an editorial pass.
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)

    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="notes")
    node: Mapped["StructureNode | None"] = relationship("StructureNode", foreign_keys=[node_id], back_populates="notes")
