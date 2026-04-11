import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Outline(Base):
    """A named outline for a story — stories can have multiple outlines."""

    __tablename__ = "outlines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, default="Outline")
    position: Mapped[int] = mapped_column(Integer, default=0)
    source_beat_sheet_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="outlines")
    items: Mapped[list["OutlineItem"]] = relationship(
        "OutlineItem", back_populates="outline", cascade="all, delete-orphan",
        order_by="OutlineItem.position",
    )


class OutlineItem(Base):
    """A hierarchical outline beat or plot point within an outline."""

    __tablename__ = "outline_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    outline_id: Mapped[str] = mapped_column(String, ForeignKey("outlines.id"), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("outline_items.id"), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=0)  # 0 = root
    position: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text, default="")
    beat_type: Mapped[str | None] = mapped_column(String, nullable=True)  # plot, character, theme, setting
    notes: Mapped[str] = mapped_column(Text, default="")
    collapsed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    outline: Mapped["Outline"] = relationship("Outline", back_populates="items")
    children: Mapped[list["OutlineItem"]] = relationship(
        "OutlineItem",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="OutlineItem.position",
    )
    parent: Mapped["OutlineItem | None"] = relationship(
        "OutlineItem", back_populates="children", remote_side="OutlineItem.id"
    )
