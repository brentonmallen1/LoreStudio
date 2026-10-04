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
