from datetime import datetime

from pydantic import BaseModel


class SeriesCreate(BaseModel):
    name: str
    premise: str = ""
    intent: str = ""
    #: Books to start with, in series order.
    story_ids: list[str] = []


class SeriesUpdate(BaseModel):
    name: str | None = None
    premise: str | None = None
    intent: str | None = None


class SeriesBookOut(BaseModel):
    story_id: str
    title: str
    position: int
    updated_at: datetime | None = None


class SeriesMemberOut(BaseModel):
    story_id: str
    ref_id: str
    #: The book's place in the series, from 0.
    position: int


class SeriesElementOut(BaseModel):
    id: str
    kind: str
    #: The frontend's name for the kind (lib/lorebook/kinds.ts), where it differs.
    lore_kind: str
    name: str
    members: list[SeriesMemberOut]
    #: Shared research, kept in step in every book (v1.5): not in the Canon.
    synced: bool = False


class SeriesOut(BaseModel):
    id: str
    name: str
    premise: str
    intent: str
    field_classes: dict
    books: list[SeriesBookOut]
    elements: list[SeriesElementOut]


class SeriesSummary(BaseModel):
    id: str
    name: str
    books: list[SeriesBookOut]


class StorySeriesOut(BaseModel):
    """The series a book is in, for every surface of that book's workspace."""

    series: SeriesOut | None
    position: int | None = None


class BooksOrder(BaseModel):
    story_ids: list[str]


class BookJoin(BaseModel):
    story_id: str
    position: int | None = None


class ElementLift(BaseModel):
    kind: str
    story_id: str
    ref_id: str


class MemberAdd(BaseModel):
    story_id: str
    #: A row this book already has (link it); left out, the element is copied in.
    ref_id: str | None = None


class CarryCandidate(BaseModel):
    """Something a sequel could start with (GET /stories/{id}/carry-over)."""

    kind: str
    lore_kind: str
    #: The row in this book; None for a series element this book does not have.
    ref_id: str | None
    element_id: str | None
    name: str
    in_series: bool
    parent_ref_id: str | None = None
    #: Ticked to begin with: what the series already shares, and threads and twists the
    #: books have left open.
    preselect: bool = False


class CarryItem(BaseModel):
    kind: str | None = None
    ref_id: str | None = None
    element_id: str | None = None


class SequelCreate(BaseModel):
    title: str
    description: str = ""
    #: Left out, the sequel is laid out like the book before it.
    structure_template_id: str | None = None
    scaffold: bool = True
    carry: list[CarryItem] = []
    #: For the series a sequel to a standalone book starts; defaults to that book's title.
    series_name: str | None = None


class FieldValueOut(BaseModel):
    story_id: str
    position: int
    value: str


class ElementFieldOut(BaseModel):
    key: str
    #: "enduring" (one truth across the series) or "evolving" (each book its own).
    field_class: str
    values: list[FieldValueOut]
    #: Enduring only: the books do not agree.
    differs: bool = False


class ElementDetailOut(BaseModel):
    """One element across its books, field by field (the progression and the disagreements)."""

    element: SeriesElementOut
    fields: list[ElementFieldOut]


class FieldPropagate(BaseModel):
    field: str
    #: The book whose value becomes every book's.
    source_story_id: str


class FieldClassSet(BaseModel):
    kind: str
    field: str
    #: "enduring", "evolving", or None for the kind's default.
    field_class: str | None = None


class SeriesFindingOut(BaseModel):
    """One series finding, once for the series, with the books it stands in: books that
    disagree about what stays true (``series-canon``), or a thread across books."""

    id: str
    check: str = "series-canon"
    text: str
    evidence: str
    suggestion: str
    #: The element it is about; a thread only one book has has none.
    element_id: str | None
    #: ``series-canon`` only: the field the books disagree about.
    field: str
    story_ids: list[str]
    #: A thread finding: the thread in the first book it stands in, to open its sheet.
    ref_id: str | None = None


class SharedOut(BaseModel):
    """Research the series shares (v1.5): which books hold it, and whether they agree."""

    element_id: str
    kind: str
    name: str
    members: list[SeriesMemberOut]
    #: Every copy says the same.
    in_step: bool
    #: Books of the series without a copy (one was deleted there, or kept apart).
    missing: list[str]


class SyncFrom(BaseModel):
    """Make this book's copy every book's."""

    source_story_id: str
