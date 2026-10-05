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
    #: The series' plan (v2), all optional. Its arc: beats owned by the series,
    #: ``[{"id", "name", "description"}]``, each placed on the books that carry it
    #: (``SeriesStory.arc_beats``).
    arc: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    #: What changes from book to book: ``[{"id", "kind", "label", "pov"}]``, kind one of
    #: character, era, location, custom. ``pov`` marks the axis whose character each book is
    #: seen through, the one scenes' POV is checked against.
    axes: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")

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
    scene_links: Mapped[list["SeriesSceneLink"]] = relationship(
        "SeriesSceneLink", back_populates="series", cascade="all, delete-orphan"
    )


class SeriesStory(Base):
    """One book's place in a series. A book belongs to at most one series."""

    __tablename__ = "series_stories"
    __table_args__ = (UniqueConstraint("story_id", name="uq_series_story"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id: Mapped[str] = mapped_column(String, ForeignKey("series.id"), nullable=False, index=True)
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    #: This book's part in the series, in the author's words: what it does that the others don't.
    role: Mapped[str] = mapped_column(Text, default="", server_default="")
    #: This book on each axis: ``{axis_id: {"element_id": str | None, "text": str}}``. An
    #: element when it is linked to the canon; else the text is an idea not yet made real.
    slots: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    #: The ids of the series arc's beats this book carries.
    arc_beats: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
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


class SeriesSceneLink(Base):
    """A setup in one book that pays off in another (v1.5): the gun on the wall in Book 1
    that fires in Book 3. A scene link joins two scenes of one book; this joins two books.

    The scene ids have no foreign key, like a member's ``ref_id``: restoring a book's
    snapshot puts its scenes back with the same ids, and the link holds. A link whose scene
    is gone is skipped by every read and pruned by the series endpoints. It goes when either
    book leaves the series. Its undo lives in the book it was made in.
    """

    __tablename__ = "series_scene_links"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id: Mapped[str] = mapped_column(String, ForeignKey("series.id"), nullable=False, index=True)
    #: The earlier scene, the setup, and its book.
    source_story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    source_node_id: Mapped[str] = mapped_column(String, nullable=False)
    #: The later scene, the payoff, and its book.
    target_story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    target_node_id: Mapped[str] = mapped_column(String, nullable=False)
    #: The scene links' own kinds: foreshadowing, callback, parallel, causes, contrast, echoes.
    link_type: Mapped[str] = mapped_column(String, default="foreshadowing")
    note: Mapped[str] = mapped_column(Text, default="")
    #: The book it was made from, whose undo takes it back.
    created_in_story_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    series: Mapped["Series"] = relationship("Series", back_populates="scene_links")
