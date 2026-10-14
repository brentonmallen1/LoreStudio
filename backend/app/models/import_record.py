import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class ImportRecord(Base):
    """One time a story was brought in (doc 28): from what, what came over and where, and what
    had no place, so the author can always see what an import did and download the original."""

    __tablename__ = "import_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    #: novelcrafter | document | script
    source: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, default="")
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    #: The original file, kept as a story asset. No foreign key, as `era_id`: the record
    #: outlives the file, which then reads as gone.
    asset_id: Mapped[str | None] = mapped_column(String, nullable=True)
    #: [{origin, name, became_type, became_id}]: each piece of the file and the row it became.
    manifest: Mapped[list] = mapped_column(JSON, default=list)
    #: [{what, why, count, examples}]: in the file, with no place in LoreStudio.
    left_out: Mapped[list] = mapped_column(JSON, default=list)
    #: Kinds of thing the file could have held and did not (nothing lost there).
    nothing_set: Mapped[list] = mapped_column(JSON, default=list)
    #: What the source app keeps that its export leaves out.
    not_in_file: Mapped[list] = mapped_column(JSON, default=list)
    #: The file's own metadata for every entry and snippet, untouched.
    raw: Mapped[dict] = mapped_column(JSON, default=dict)

    story: Mapped["Story"] = relationship("Story", back_populates="import_records")
    items: Mapped[list["ImportedItem"]] = relationship(
        "ImportedItem", back_populates="record", cascade="all, delete-orphan", order_by="ImportedItem.position"
    )


class ImportedItem(Base):
    """Something an import brought with no home chosen yet (doc 28): it waits in Proposals ›
    Imported until the author places it, keeps it in the Compendium, or says it isn't needed.
    Placed or declined, the row stays, so the record still says where everything went."""

    __tablename__ = "imported_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    record_id: Mapped[str] = mapped_column(
        String, ForeignKey("import_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    origin: Mapped[str] = mapped_column(String, default="")
    #: What it was in the source app: lore, other, snippet, …
    origin_type: Mapped[str] = mapped_column(String, default="")
    name: Mapped[str] = mapped_column(String, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    #: The item as the file had it, and what the import made for it (its image, its links).
    raw: Mapped[dict] = mapped_column(JSON, default=dict)
    #: waiting | placed | declined
    status: Mapped[str] = mapped_column(String, default="waiting")
    became_type: Mapped[str | None] = mapped_column(String, nullable=True)
    became_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sorted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    record: Mapped["ImportRecord"] = relationship("ImportRecord", back_populates="items")
