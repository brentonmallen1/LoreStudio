import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story
    from .user import User


class Series(Base):
    """Books that belong together, in the order the author reads them (series doc).

    A series owns no story content. Each book keeps its own complete rows; the series
    only says which books it holds, in what order, and which rows in different books are
    the same thing (``SeriesElement``). That is why none of these tables is in a story's
    snapshot: they are identity across stories, not part of any one of them.
    """

    __tablename__ = "series"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    premise: Mapped[str] = mapped_column(Text, default="", server_default="")
    #: What the series is for, across its books: the author's intent, as a story has.
    intent: Mapped[str] = mapped_column(Text, default="", server_default="")
    #: Per-kind overrides of which fields stay true across the series:
    #: ``{"character": {"appearance": "evolving"}}``. Defaults live in services/series/kinds.py.
    field_classes: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped["User"] = relationship("User")
    books: Mapped[list["SeriesStory"]] = relationship(
        "SeriesStory", back_populates="series", cascade="all, delete-orphan", order_by="SeriesStory.position"
    )
    elements: Mapped[list["SeriesElement"]] = relationship(
        "SeriesElement", back_populates="series", cascade="all, delete-orphan"
    )


class SeriesStory(Base):
    """One book's place in a series. A book belongs to at most one series."""

    __tablename__ = "series_stories"
    __table_args__ = (UniqueConstraint("story_id", name="uq_series_story"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id: Mapped[str] = mapped_column(String, ForeignKey("series.id"), nullable=False, index=True)
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    series: Mapped["Series"] = relationship("Series", back_populates="books")
    story: Mapped["Story"] = relationship("Story", back_populates="series_membership")


class SeriesElement(Base):
    """One character, place or world element across the books it appears in.

    Its rows are ordinary rows in each book (``SeriesElementMember``), so everything that
    works on one book keeps working; this row only says they are the same thing.
    """

    __tablename__ = "series_elements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id: Mapped[str] = mapped_column(String, ForeignKey("series.id"), nullable=False, index=True)
    #: A key of services/series/kinds.SERIES_KINDS ("character", "location", ...).
    kind: Mapped[str] = mapped_column(String, nullable=False)
    #: The name as last seen, for lists that should not have to load every book's row.
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    series: Mapped["Series"] = relationship("Series", back_populates="elements")
    members: Mapped[list["SeriesElementMember"]] = relationship(
        "SeriesElementMember", back_populates="element", cascade="all, delete-orphan"
    )


class SeriesElementMember(Base):
    """An element as it is in one book: which row there is the series element.

    ``ref_id`` has no foreign key (the ``Note.about_id`` pattern), so deleting the
    character never fails on it; a member whose row is gone is pruned by the series
    endpoints, never by a read that should not write.
    """

    __tablename__ = "series_element_members"
    __table_args__ = (UniqueConstraint("element_id", "story_id", name="uq_series_element_member"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    element_id: Mapped[str] = mapped_column(String, ForeignKey("series_elements.id"), nullable=False, index=True)
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    ref_table: Mapped[str] = mapped_column(String, nullable=False)
    ref_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    element: Mapped["SeriesElement"] = relationship("SeriesElement", back_populates="members")
    story: Mapped["Story"] = relationship("Story", back_populates="series_element_members")
