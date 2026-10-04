"""The series' own views of its promises (v1.5): the tapestry by book, the setups that cross
books, and the story so far, book by book."""

from pydantic import BaseModel

from .promises import BookScene, BookStep


class SeriesBookRef(BaseModel):
    position: int
    story_id: str
    title: str


class SeriesLane(BaseModel):
    """One thread or twist the series shares, with what each book that has it does there."""

    element_id: str
    kind: str  # thread | twist
    name: str
    color_slot: int
    #: Where it stands after the last book that has it: open | resolved | set_aside | planned
    #: for a thread, planted | revealed | planned for a twist.
    status: str
    steps: list[BookStep]


class SeriesLinkOut(BaseModel):
    id: str
    link_type: str
    note: str
    source: BookScene
    target: BookScene


class SeriesPromisesOut(BaseModel):
    books: list[SeriesBookRef]
    lanes: list[SeriesLane]
    setups: list[SeriesLinkOut]


class SoFarItem(BaseModel):
    text: str
    #: clue | reveal | you
    source: str
    story_id: str
    node_id: str | None = None
    #: A belief a later scene overturns: where, "Book 3 · The Return".
    over: str | None = None


class SoFarCharacter(BaseModel):
    """Where a character the series shares ends this book: what changed here."""

    name: str
    kind: str
    ref_id: str
    #: Evolving fields that differ from the book before (or, first seen, what they want).
    changed: dict[str, str]
    first_here: bool = False


class SoFarOpen(BaseModel):
    kind: str  # thread | twist
    name: str
    #: Its row in the last book that has it, to open its sheet there.
    story_id: str
    ref_id: str
    said: str


class BookSoFar(BaseModel):
    """One book, as it leaves the reader: the series page's The story so far (decision 9)."""

    position: int
    story_id: str
    title: str
    summary: str
    characters: list[SoFarCharacter]
    learned: list[SoFarItem]
    believes: list[SoFarItem]
    only: list[SoFarItem]
    open: list[SoFarOpen]


class SceneLinkCreate(BaseModel):
    """A setup across books, made from either end: this book's scene and the other book's."""

    story_id: str
    node_id: str
    other_story_id: str
    other_node_id: str
    link_type: str = "foreshadowing"
    note: str = ""


class SceneLinkUpdate(BaseModel):
    link_type: str | None = None
    note: str | None = None
