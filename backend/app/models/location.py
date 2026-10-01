import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .location_travel import LocationTravel
    from .story import Story
    from .structure import StructureNode


PREDEFINED_LOCATION_TYPES = [
    # Celestial
    "star_system",
    "star",
    "planet",
    "gas_giant",
    "moon",
    "asteroid_belt",
    "orbital_station",
    "space_habitat",
    # Terrestrial
    "continent",
    "region",
    "territory",
    "settlement",
    "district",
    "landmark",
    "structure",
    "natural_feature",
    # Mobile
    "vessel",
]


class Location(Base):
    """A place that exists in the story world — world building reference material."""

    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("locations.id"), nullable=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    #: Other names the prose uses for this place; a found place merged into it leaves its name here.
    aliases: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    location_type: Mapped[str] = mapped_column(String, default="")  # predefined or custom freeform
    climate: Mapped[str] = mapped_column(String, default="")
    terrain: Mapped[str] = mapped_column(Text, default="")
    political_affiliation: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    atmosphere: Mapped[str] = mapped_column(Text, default="")
    history: Mapped[str] = mapped_column(Text, default="")
    significance: Mapped[str] = mapped_column(Text, default="")
    # Celestial / sci-fi properties (optional; leave blank for non-space stories)
    orbital_period: Mapped[str] = mapped_column(String, default="")
    distance_from_parent: Mapped[str] = mapped_column(String, default="")
    gravity: Mapped[str] = mapped_column(String, default="")
    habitability: Mapped[str] = mapped_column(String, default="")
    radiation_level: Mapped[str] = mapped_column(String, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Discovery provenance — set when created via discovery approval
    is_stub: Mapped[bool] = mapped_column(Boolean, default=False)
    #: Palette slot 1..8 (doc 11 P2); 0 until chosen or assigned.
    color_slot: Mapped[int] = mapped_column(Integer, default=0)
    discovered_from_id: Mapped[str | None] = mapped_column(String, ForeignKey("discovered_elements.id"), nullable=True)
    discovered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="locations")
    children: Mapped[list["Location"]] = relationship(
        "Location",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Location.position",
    )
    parent: Mapped["Location | None"] = relationship("Location", back_populates="children", remote_side="Location.id")
    scene_settings: Mapped[list["SceneSetting"]] = relationship(
        "SceneSetting", back_populates="location", cascade="all, delete-orphan"
    )
    travel_from: Mapped[list["LocationTravel"]] = relationship(
        "LocationTravel",
        foreign_keys="LocationTravel.from_location_id",
        back_populates="from_location",
        cascade="all, delete-orphan",
    )
    travel_to: Mapped[list["LocationTravel"]] = relationship(
        "LocationTravel",
        foreign_keys="LocationTravel.to_location_id",
        back_populates="to_location",
        cascade="all, delete-orphan",
    )


class ScenePresence(Base):
    """
    The author's answer to "who is actually here" for one scene (doc 07 §3).

    Codex derives presence from point of view, attributed dialogue and names in the prose,
    but only the author knows whether a name in a paragraph is someone in the room or
    someone being talked about. That answer is authored data, so it lives here in the
    Lorebook — snapshot, export and undo all reach it — and Codex reads it as the strongest
    signal rather than storing a second copy of it.
    """

    __tablename__ = "scene_presence"
    __table_args__ = (UniqueConstraint("node_id", "character_id", name="uq_scene_presence"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[str] = mapped_column(
        String, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: pov | participant | mentioned | absent — "absent" is a real answer, and the useful one
    role: Mapped[str] = mapped_column(String, default="participant")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SceneSetting(Base):
    """Junction table: a location linked to a scene as its setting."""

    __tablename__ = "scene_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, default="primary")  # primary, mentioned, flashback
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    location: Mapped["Location"] = relationship("Location", back_populates="scene_settings")
    node: Mapped["StructureNode"] = relationship("StructureNode", back_populates="scene_settings")
