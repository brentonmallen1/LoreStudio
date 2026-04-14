import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class StoryStructureTemplate(Base):
    """Defines available story structure frameworks (system-seeded + user-created)."""

    __tablename__ = "story_structure_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    levels: Mapped[list] = mapped_column(JSON, nullable=False)
    # levels format: [{"name": "Act", "plural": "Acts"}, {"name": "Chapter", ...}, ...]
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, default=None)


class StructureNode(Base):
    """A node in the story's hierarchical structure (act, chapter, scene, beat, etc.)."""

    __tablename__ = "structure_nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=True, index=True)
    level: Mapped[int] = mapped_column(Integer, default=0)  # 0 = top level
    level_type: Mapped[str] = mapped_column(String, default="section")  # act, chapter, scene, beat, etc.
    title: Mapped[str] = mapped_column(String, default="Untitled")
    synopsis: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")  # Prose for leaf nodes
    position: Mapped[int] = mapped_column(Integer, default=0)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="draft")  # draft, revised, final
    entry_state: Mapped[str] = mapped_column(Text, default="")
    exit_state: Mapped[str] = mapped_column(Text, default="")
    key_events: Mapped[str] = mapped_column(Text, default="")
    timeline_position: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    content_summary: Mapped[str] = mapped_column(Text, default="", server_default="")
    summary_stale: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    summary_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    beat_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    pov_character_id: Mapped[str | None] = mapped_column(String, ForeignKey("characters.id"), nullable=True, default=None)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    pov_character: Mapped["Character | None"] = relationship("Character", foreign_keys=[pov_character_id], uselist=False)
    story: Mapped["Story"] = relationship("Story", back_populates="structure_nodes")
    children: Mapped[list["StructureNode"]] = relationship(
        "StructureNode",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="StructureNode.position",
    )
    parent: Mapped["StructureNode | None"] = relationship(
        "StructureNode", back_populates="children", remote_side="StructureNode.id"
    )
