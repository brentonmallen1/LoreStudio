import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .character_journey import CharacterJourneySummary
    from .dialogue import DialogueBlock
    from .interview import CharacterInterview
    from .story import Story
    from .structure import StructureNode


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(
        String, default="deuteragonist"
    )  # protagonist, deuteragonist, antagonist, love_interest, confidant, foil, tertiary
    character_type: Mapped[str] = mapped_column(String, default="")  # round, flat, dynamic, static, stock, symbolic
    jungian_archetype: Mapped[str] = mapped_column(
        String, default=""
    )  # lover, hero, magician, outlaw, explorer, sage, innocent, creator, ruler, caregiver, everyman, jester
    narrative_archetype: Mapped[str] = mapped_column(
        String, default=""
    )  # hero, mentor, threshold_guardian, herald, shapeshifter, shadow, trickster, ally
    personality: Mapped[str] = mapped_column(Text, default="")
    motivation: Mapped[str] = mapped_column(Text, default="")
    background: Mapped[str] = mapped_column(Text, default="")
    appearance: Mapped[str] = mapped_column(Text, default="")
    arc_notes: Mapped[str] = mapped_column(Text, default="")
    # What makes a character particular, as plain fields the author fills in (Writer mode
    # had nowhere to put these; they existed only as AI suggestions).
    flaws: Mapped[str] = mapped_column(Text, default="", server_default="")
    quirks: Mapped[str] = mapped_column(Text, default="", server_default="")
    speech_patterns: Mapped[str] = mapped_column(Text, default="", server_default="")
    interview_prompts: Mapped[list] = mapped_column(JSON, default=list)  # list of strings
    traits: Mapped[dict] = mapped_column(JSON, default=dict)  # flexible key-value traits
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)  # intelligence, alignment, etc.

    # One-sentence core drive: visible in interviews and hover cards
    mission_statement: Mapped[str] = mapped_column(Text, default="")

    # Author-facing: what is this character FOR in the story (hidden from character interviews)
    narrative_intent: Mapped[str] = mapped_column(Text, default="")
    narrative_intent_hidden: Mapped[bool] = mapped_column(Boolean, default=True)

    # Pronouns: he/him, she/her, they/them, or custom
    pronouns: Mapped[str] = mapped_column(String, default="")

    # Arc milestones: checkable waypoints for character journey
    arc_milestones: Mapped[list] = mapped_column(JSON, default=list)

    # Discovery notes: unconfirmed observations captured mid-story
    discovery_notes: Mapped[list] = mapped_column(JSON, default=list)
    # Format: [{"id": "uuid", "text": "...", "scene_id": null, "scene_title": null, "timestamp": "iso", "confirmed": false}]

    # Snowflake Method layers
    snowflake_summary: Mapped[str] = mapped_column(Text, default="")  # Layer 3: goal, motivation, conflict, epiphany
    snowflake_synopsis: Mapped[str] = mapped_column(Text, default="")  # Layer 5: full arc told in first person
    # Format: [{"id": "uuid", "text": "First moment of doubt", "completed": false}]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="characters", foreign_keys="Character.story_id")
    interviews: Mapped[list["CharacterInterview"]] = relationship(
        "CharacterInterview", back_populates="character", cascade="all, delete-orphan"
    )
    relationships_out: Mapped[list["CharacterRelationship"]] = relationship(
        "CharacterRelationship",
        foreign_keys="CharacterRelationship.character_id",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    relationships_in: Mapped[list["CharacterRelationship"]] = relationship(
        "CharacterRelationship",
        foreign_keys="CharacterRelationship.related_character_id",
        back_populates="related_character",
        cascade="all, delete-orphan",
    )
    journey_summaries: Mapped[list["CharacterJourneySummary"]] = relationship(
        "CharacterJourneySummary", back_populates="character", cascade="all, delete-orphan"
    )
    # Nulled (not deleted) when the character goes away:
    dialogue_blocks: Mapped[list["DialogueBlock"]] = relationship(
        "DialogueBlock", foreign_keys="DialogueBlock.character_id", back_populates="character"
    )
    pov_nodes: Mapped[list["StructureNode"]] = relationship(
        "StructureNode", foreign_keys="StructureNode.pov_character_id", back_populates="pov_character"
    )
    pov_stories: Mapped[list["Story"]] = relationship(
        "Story", foreign_keys="Story.pov_character_id", back_populates="pov_character", post_update=True
    )


class CharacterRelationship(Base):
    __tablename__ = "character_relationships"
    __table_args__ = (UniqueConstraint("character_id", "related_character_id", name="uq_relationship_directed_pair"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False, index=True)
    related_character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String, default="acquaintance")
    description: Mapped[str] = mapped_column(Text, default="")

    # Multi-dimensional strength: {"trust": 0-10, "power": 0-10, "affection": 0-10}
    strength: Mapped[dict] = mapped_column(JSON, default=dict)
    # visibility: "public" or "hidden" (hidden = exists but not known to other characters in-world)
    visibility: Mapped[str] = mapped_column(String, default="public")
    # Narrative purposes: ["conflict-driver", "ally", "foil", "growth-catalyst", ...]
    narrative_purpose: Mapped[list] = mapped_column(JSON, default=list)
    # Freeform author notes — first-class, not optional
    notes: Mapped[str] = mapped_column(Text, default="")
    # AI-suggested relationship (pending author acceptance)
    is_suggested: Mapped[bool] = mapped_column(Boolean, default=False)
    # Source of suggestion: "profile" (AI) or "prose" (NLP manuscript scan)
    suggestion_source: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    character: Mapped["Character"] = relationship(
        "Character", foreign_keys=[character_id], back_populates="relationships_out"
    )
    related_character: Mapped["Character"] = relationship(
        "Character", foreign_keys=[related_character_id], back_populates="relationships_in"
    )
