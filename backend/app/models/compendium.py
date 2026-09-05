import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .media import StoryAsset
    from .story import Story



class CompendiumEntry(Base):
    __tablename__ = "compendium_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)

    # Core
    title: Mapped[str] = mapped_column(String, nullable=False)
    entry_type: Mapped[str] = mapped_column(String, nullable=False)  # "note" | "url" | "document"

    # Type-specific (nullable)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_title: Mapped[str | None] = mapped_column(String, nullable=True)
    url_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    asset_id: Mapped[str | None] = mapped_column(String, ForeignKey("story_assets.id"), nullable=True)

    # Organization
    tags: Mapped[list] = mapped_column(JSON, default=list)
    category: Mapped[str] = mapped_column(String, default="general")
    notes: Mapped[str] = mapped_column(Text, default="")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="compendium_entries")
    asset: Mapped["StoryAsset | None"] = relationship("StoryAsset", back_populates="compendium_entries")
    attachments: Mapped[list["CompendiumAttachment"]] = relationship(
        "CompendiumAttachment", back_populates="entry", cascade="all, delete-orphan"
    )


class CompendiumAttachment(Base):
    """Polymorphic join: attach a CompendiumEntry to any story element."""

    __tablename__ = "compendium_attachments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    entry_id: Mapped[str] = mapped_column(String, ForeignKey("compendium_entries.id"), nullable=False)
    object_type: Mapped[str] = mapped_column(String, nullable=False)  # character/setting/structure_node/thread
    object_id: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    entry: Mapped["CompendiumEntry"] = relationship("CompendiumEntry", back_populates="attachments")
