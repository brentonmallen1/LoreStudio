import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .character import Character
    from .character_journey import CharacterJourneySummary
    from .dialogue import DialogueBlock
    from .discovered_element import DiscoveredElement
    from .location import SceneSetting
    from .note import Note
    from .plot_thread import PlotThreadAppearance
    from .reader_knowledge import ReaderKnowledgeEvent
    from .scene_link import SceneLink
    from .story import Story
    from .twist import Twist, TwistClue


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
    #: When the scene happens, in the story's own words ("November 1962", "the third winter").
    in_world_date: Mapped[str] = mapped_column(String, default="", server_default="")
    #: The era it happens in. No foreign key: a snapshot restore puts scenes back before eras,
    #: and a scene whose era is gone simply has none (as ``beat_id`` does).
    era_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    content_summary: Mapped[str] = mapped_column(Text, default="", server_default="")
    summary_stale: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    summary_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    beat_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    pov_character_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("characters.id"), nullable=True, default=None
    )
    # Author intent for the segment ("why does this exist?"): a key inside metadata_ until
    # migration 0002. Its margin notes were a JSON column until 0023; they are rows in notes.
    purpose: Mapped[str] = mapped_column(Text, default="", server_default="")
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    pov_character: Mapped["Character | None"] = relationship(
        "Character", foreign_keys=[pov_character_id], uselist=False, back_populates="pov_nodes"
    )
    story: Mapped["Story"] = relationship("Story", back_populates="structure_nodes")
    # Rows that must go when the node goes:
    dialogue_blocks: Mapped[list["DialogueBlock"]] = relationship(
        "DialogueBlock", back_populates="scene", cascade="all, delete-orphan"
    )
    scene_settings: Mapped[list["SceneSetting"]] = relationship(
        "SceneSetting", back_populates="node", cascade="all, delete-orphan"
    )
    scene_links_out: Mapped[list["SceneLink"]] = relationship(
        "SceneLink",
        foreign_keys="SceneLink.source_node_id",
        back_populates="source_node",
        cascade="all, delete-orphan",
    )
    scene_links_in: Mapped[list["SceneLink"]] = relationship(
        "SceneLink",
        foreign_keys="SceneLink.target_node_id",
        back_populates="target_node",
        cascade="all, delete-orphan",
    )
    thread_appearances: Mapped[list["PlotThreadAppearance"]] = relationship(
        "PlotThreadAppearance", back_populates="node", cascade="all, delete-orphan"
    )
    journey_summaries: Mapped[list["CharacterJourneySummary"]] = relationship(
        "CharacterJourneySummary", back_populates="up_to_node", cascade="all, delete-orphan"
    )
    # Rows that merely point at the node: their reference is nulled on delete.
    reader_knowledge_events: Mapped[list["ReaderKnowledgeEvent"]] = relationship(
        "ReaderKnowledgeEvent", foreign_keys="ReaderKnowledgeEvent.node_id", back_populates="node"
    )
    notes: Mapped[list["Note"]] = relationship("Note", foreign_keys="Note.node_id", back_populates="node")
    discovered_elements: Mapped[list["DiscoveredElement"]] = relationship(
        "DiscoveredElement", back_populates="source_node"
    )
    twists_revealed: Mapped[list["Twist"]] = relationship(
        "Twist", foreign_keys="Twist.revealed_at_node_id", back_populates="revealed_at_node"
    )
    twist_clues: Mapped[list["TwistClue"]] = relationship("TwistClue", back_populates="node")
    children: Mapped[list["StructureNode"]] = relationship(
        "StructureNode",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="StructureNode.position",
    )
    parent: Mapped["StructureNode | None"] = relationship(
        "StructureNode", back_populates="children", remote_side="StructureNode.id"
    )
