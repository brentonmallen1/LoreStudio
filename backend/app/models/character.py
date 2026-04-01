import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="supporting")  # protagonist, antagonist, supporting, minor
    personality: Mapped[str] = mapped_column(Text, default="")
    motivation: Mapped[str] = mapped_column(Text, default="")
    background: Mapped[str] = mapped_column(Text, default="")
    appearance: Mapped[str] = mapped_column(Text, default="")
    arc_notes: Mapped[str] = mapped_column(Text, default="")
    interview_prompts: Mapped[list] = mapped_column(JSON, default=list)  # list of strings
    traits: Mapped[dict] = mapped_column(JSON, default=dict)  # flexible key-value traits
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="characters")
    interviews: Mapped[list["CharacterInterview"]] = relationship(
        "CharacterInterview", back_populates="character", cascade="all, delete-orphan"
    )
    relationships_out: Mapped[list["CharacterRelationship"]] = relationship(
        "CharacterRelationship",
        foreign_keys="CharacterRelationship.character_id",
        back_populates="character",
        cascade="all, delete-orphan",
    )


class CharacterRelationship(Base):
    __tablename__ = "character_relationships"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False)
    related_character_id: Mapped[str] = mapped_column(String, ForeignKey("characters.id"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String, default="acquaintance")
    description: Mapped[str] = mapped_column(Text, default="")

    character: Mapped["Character"] = relationship(
        "Character", foreign_keys=[character_id], back_populates="relationships_out"
    )
    related_character: Mapped["Character"] = relationship("Character", foreign_keys=[related_character_id])
