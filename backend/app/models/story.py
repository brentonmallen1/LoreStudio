import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


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

    # Narrative grounding
    narrative_intent: Mapped[str] = mapped_column(Text, default="")
    premise: Mapped[str] = mapped_column(Text, default="")
    logline: Mapped[str] = mapped_column(String, default="")

    # Story goals checklist
    goals: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="stories")
    structure_nodes: Mapped[list["StructureNode"]] = relationship(
        "StructureNode", back_populates="story", cascade="all, delete-orphan"
    )
    characters: Mapped[list["Character"]] = relationship(
        "Character", back_populates="story", cascade="all, delete-orphan"
    )
    settings: Mapped[list["Setting"]] = relationship(
        "Setting", back_populates="story", cascade="all, delete-orphan"
    )
    notes: Mapped[list["StoryNote"]] = relationship(
        "StoryNote", back_populates="story", cascade="all, delete-orphan"
    )
    panel_interviews: Mapped[list["PanelInterview"]] = relationship(
        "PanelInterview", back_populates="story", cascade="all, delete-orphan"
    )
    plot_threads: Mapped[list["PlotThread"]] = relationship(
        "PlotThread", back_populates="story", cascade="all, delete-orphan"
    )
    compendium_entries: Mapped[list["CompendiumEntry"]] = relationship(
        "CompendiumEntry", back_populates="story", cascade="all, delete-orphan"
    )
