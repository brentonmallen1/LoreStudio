import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

PREDEFINED_LOCATION_TYPES = [
    # Celestial
    "star_system", "star", "planet", "gas_giant", "moon",
    "asteroid_belt", "orbital_station", "space_habitat",
    # Terrestrial
    "continent", "region", "territory",
    "settlement", "district", "landmark", "structure",
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

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="locations")
    children: Mapped[list["Location"]] = relationship(
        "Location",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Location.position",
    )
    parent: Mapped["Location | None"] = relationship(
        "Location", back_populates="children", remote_side="Location.id"
    )
    scene_settings: Mapped[list["SceneSetting"]] = relationship(
        "SceneSetting", back_populates="location", cascade="all, delete-orphan"
    )


class SceneSetting(Base):
    """Junction table: a location linked to a scene as its setting."""

    __tablename__ = "scene_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, default="primary")  # primary, mentioned, flashback
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    location: Mapped["Location"] = relationship("Location", back_populates="scene_settings")
    node: Mapped["StructureNode"] = relationship("StructureNode")
