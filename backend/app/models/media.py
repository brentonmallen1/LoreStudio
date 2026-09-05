import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .compendium import CompendiumEntry
    from .story import Story


class StoryAsset(Base):
    __tablename__ = "story_assets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    stored_path: Mapped[str] = mapped_column(String, nullable=False)  # relative to data/uploads/
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    alt_text: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="assets")
    compendium_entries: Mapped[list["CompendiumEntry"]] = relationship(
        "CompendiumEntry", back_populates="asset"
    )  # no delete cascade: entries survive, asset_id is nulled
    attachments: Mapped[list["AssetAttachment"]] = relationship(
        "AssetAttachment", back_populates="asset", cascade="all, delete-orphan"
    )


class AssetAttachment(Base):
    """Polymorphic join: attach a StoryAsset to any object (character/setting/structure_node/diagram)."""

    __tablename__ = "asset_attachments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_id: Mapped[str] = mapped_column(String, ForeignKey("story_assets.id"), nullable=False)
    object_type: Mapped[str] = mapped_column(String, nullable=False)  # character/setting/structure_node/diagram
    object_id: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="reference")  # portrait/cover/reference/inspiration/background
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    asset: Mapped["StoryAsset"] = relationship("StoryAsset", back_populates="attachments")
