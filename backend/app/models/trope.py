import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .character import Character, CharacterRelationship
    from .story import Story
    from .structure import StructureNode

#: What the author does with the trope (doc 27). "undecided" until they say.
STANCES = ("undecided", "straight", "subverted", "inverted", "averted", "deconstructed", "lampshaded")


class Trope(Base):
    """A trope in play: where it applies and what the author means to do with it (doc 27).

    The definition is reference, and lives in the Compendium; this row is the author's intent.
    A trope with no links applies to the whole story.
    """

    __tablename__ = "tropes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    stance: Mapped[str] = mapped_column(String, default="undecided")
    why: Mapped[str] = mapped_column(Text, default="")
    #: The thread that tracks the expectation the trope sets up. No foreign key, as `era_id`:
    #: undoing the thread's delete brings the link back, and a missing thread reads as none.
    thread_id: Mapped[str | None] = mapped_column(String, nullable=True)
    #: The Compendium entry holding the definition. No foreign key, for the same reason.
    definition_id: Mapped[str | None] = mapped_column(String, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="tropes")
    links: Mapped[list["TropeLink"]] = relationship(
        "TropeLink", back_populates="trope", cascade="all, delete-orphan", order_by="TropeLink.created_at"
    )


class TropeLink(Base):
    """Where a trope plays: a character, a relationship between two, or a scene. One of each row."""

    __tablename__ = "trope_links"
    __table_args__ = (
        CheckConstraint(
            "(character_id IS NOT NULL) + (relationship_id IS NOT NULL) + (node_id IS NOT NULL) = 1",
            name="ck_trope_links_one_target",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    trope_id: Mapped[str] = mapped_column(
        String, ForeignKey("tropes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("characters.id", ondelete="CASCADE"), nullable=True, index=True
    )
    relationship_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("character_relationships.id", ondelete="CASCADE"), nullable=True, index=True
    )
    node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    trope: Mapped["Trope"] = relationship("Trope", back_populates="links")
    character: Mapped["Character | None"] = relationship("Character", back_populates="trope_links")
    relationship_row: Mapped["CharacterRelationship | None"] = relationship(
        "CharacterRelationship", back_populates="trope_links"
    )
    node: Mapped["StructureNode | None"] = relationship("StructureNode", back_populates="trope_links")
