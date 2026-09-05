import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .calendar import Calendar
    from .character import Character
    from .chat_session import ChatSession
    from .compendium import CompendiumEntry
    from .culture import Culture
    from .diagram import Diagram
    from .discovered_element import DiscoveredElement
    from .historical_event import Era, HistoricalEvent
    from .location import Location
    from .media import StoryAsset
    from .note import StoryNote
    from .outline import Outline
    from .panel_interview import PanelInterview
    from .plot_thread import PlotThread
    from .reader_knowledge import ReaderKnowledgeEvent
    from .scene_link import SceneLink
    from .setting import Setting
    from .snapshot import StoryBackupSettings, StorySnapshot
    from .structure import StructureNode
    from .todo import StoryTodo
    from .twist import Twist
    from .user import User
    from .world_system import WorldSystem


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    intent: Mapped[str] = mapped_column(Text, default="")  # System-level LLM context
    structure_template_id: Mapped[str] = mapped_column(String, default="freeform")

    # Lorebook fields
    genre: Mapped[str] = mapped_column(String, default="")
    tone: Mapped[str] = mapped_column(String, default="")
    themes: Mapped[list] = mapped_column(JSON, default=list)
    central_conflict: Mapped[str] = mapped_column(Text, default="")
    target_audience: Mapped[str] = mapped_column(String, default="")
    intended_length: Mapped[str] = mapped_column(String, default="")
    beat_sheet_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    # Narrative grounding
    narrative_intent: Mapped[str] = mapped_column(Text, default="")
    premise: Mapped[str] = mapped_column(Text, default="")
    logline: Mapped[str] = mapped_column(String, default="")
    # Byline for exports and the title page. Optional; the account name is not assumed.
    author_name: Mapped[str] = mapped_column(String, default="", server_default="")

    # Narrative perspective
    narrative_perspective: Mapped[str] = mapped_column(String, default="")
    pov_character_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("characters.id", use_alter=True, name="fk_stories_pov_character_id"), nullable=True
    )

    # Snowflake Method layers
    snowflake_sentence: Mapped[str] = mapped_column(Text, default="")
    snowflake_paragraph: Mapped[str] = mapped_column(Text, default="")
    snowflake_synopsis: Mapped[str] = mapped_column(Text, default="")

    # Story goals checklist
    goals: Mapped[list] = mapped_column(JSON, default=list)

    # Discovery writer settings
    discovery_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    discovery_auto_analyze: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    discovery_element_types: Mapped[list] = mapped_column(
        JSON, default=lambda: ["character", "setting", "relationship"]
    )
    discovery_min_confidence: Mapped[float] = mapped_column(Float, default=0.6, server_default="0.6")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped["User"] = relationship("User", back_populates="stories")
    pov_character: Mapped["Character | None"] = relationship(
        "Character",
        foreign_keys=[pov_character_id],
        uselist=False,
        back_populates="pov_stories",
        post_update=True,
    )
    structure_nodes: Mapped[list["StructureNode"]] = relationship(
        "StructureNode", back_populates="story", cascade="all, delete-orphan"
    )
    characters: Mapped[list["Character"]] = relationship(
        "Character",
        back_populates="story",
        cascade="all, delete-orphan",
        foreign_keys="Character.story_id",
    )
    settings: Mapped[list["Setting"]] = relationship("Setting", back_populates="story", cascade="all, delete-orphan")
    notes: Mapped[list["StoryNote"]] = relationship("StoryNote", back_populates="story", cascade="all, delete-orphan")
    panel_interviews: Mapped[list["PanelInterview"]] = relationship(
        "PanelInterview", back_populates="story", cascade="all, delete-orphan"
    )
    plot_threads: Mapped[list["PlotThread"]] = relationship(
        "PlotThread", back_populates="story", cascade="all, delete-orphan"
    )
    discovered_elements: Mapped[list["DiscoveredElement"]] = relationship(
        "DiscoveredElement", back_populates="story", cascade="all, delete-orphan"
    )
    compendium_entries: Mapped[list["CompendiumEntry"]] = relationship(
        "CompendiumEntry", back_populates="story", cascade="all, delete-orphan"
    )
    locations: Mapped[list["Location"]] = relationship("Location", back_populates="story", cascade="all, delete-orphan")
    world_systems: Mapped[list["WorldSystem"]] = relationship(
        "WorldSystem", back_populates="story", cascade="all, delete-orphan"
    )
    cultures: Mapped[list["Culture"]] = relationship("Culture", back_populates="story", cascade="all, delete-orphan")
    eras: Mapped[list["Era"]] = relationship("Era", back_populates="story", cascade="all, delete-orphan")
    historical_events: Mapped[list["HistoricalEvent"]] = relationship(
        "HistoricalEvent", back_populates="story", cascade="all, delete-orphan"
    )
    calendars: Mapped[list["Calendar"]] = relationship("Calendar", back_populates="story", cascade="all, delete-orphan")
    twists: Mapped[list["Twist"]] = relationship("Twist", back_populates="story", cascade="all, delete-orphan")
    todos: Mapped[list["StoryTodo"]] = relationship("StoryTodo", back_populates="story", cascade="all, delete-orphan")
    outlines: Mapped[list["Outline"]] = relationship(
        "Outline",
        back_populates="story",
        cascade="all, delete-orphan",
        order_by="Outline.position",
    )
    snapshots: Mapped[list["StorySnapshot"]] = relationship(
        "StorySnapshot", back_populates="story", cascade="all, delete-orphan"
    )
    backup_settings: Mapped["StoryBackupSettings | None"] = relationship(
        "StoryBackupSettings", back_populates="story", uselist=False, cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="story", cascade="all, delete-orphan"
    )
    diagrams: Mapped[list["Diagram"]] = relationship("Diagram", back_populates="story", cascade="all, delete-orphan")
    scene_links: Mapped[list["SceneLink"]] = relationship(
        "SceneLink", back_populates="story", cascade="all, delete-orphan"
    )
    reader_knowledge_events: Mapped[list["ReaderKnowledgeEvent"]] = relationship(
        "ReaderKnowledgeEvent", back_populates="story", cascade="all, delete-orphan"
    )
    assets: Mapped[list["StoryAsset"]] = relationship(
        "StoryAsset", back_populates="story", cascade="all, delete-orphan"
    )
