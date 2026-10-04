"""Promises (doc 18 C2): threads, twists, setups and what the reader knows, in reading order.

One answer for the tapestry and the pages under it, so each draws the same story.
"""

from pydantic import BaseModel


class PromiseScene(BaseModel):
    id: str
    title: str
    index: int
    chapter_id: str | None
    #: Has prose; a scene with none is planned.
    written: bool


class PromiseChapter(BaseModel):
    id: str
    title: str
    first: int
    count: int


class ThreadBeat(BaseModel):
    node_id: str
    index: int
    role: str
    note: str


class PromiseThread(BaseModel):
    id: str
    name: str
    description: str
    color_slot: int
    mice_type: str | None
    status: str
    beats: list[ThreadBeat]


class PromiseClue(BaseModel):
    id: str
    node_id: str | None
    #: The scene's place in the book; None for a clue not placed yet.
    index: int | None
    text: str
    points_to: str
    subtlety: str
    quote: str


class PromiseTwist(BaseModel):
    id: str
    name: str
    color_slot: int
    status: str
    twist_type: str
    the_truth: str
    the_misdirection: str
    reveal_node_id: str | None
    reveal_index: int | None
    #: In reading order; unplaced clues last.
    clues: list[PromiseClue]


class Setup(BaseModel):
    """A scene link, earlier scene first: what it sets up and where that pays off or echoes."""

    id: str
    link_type: str
    from_node_id: str
    to_node_id: str
    from_index: int
    to_index: int
    note: str


class ReaderItem(BaseModel):
    text: str
    #: clue | reveal | you (a hand entry in What the reader knows)
    source: str
    twist_id: str | None = None
    event_id: str | None = None
    #: A belief the story has since overturned: the reader no longer holds it.
    over: bool = False


class ReaderRow(BaseModel):
    node_id: str
    index: int
    learns: list[ReaderItem] = []
    believes: list[ReaderItem] = []
    only: list[ReaderItem] = []


class PromiseCheck(BaseModel):
    check: str
    severity: str  # low | medium | high
    text: str
    suggestion: str = ""
    thread_id: str | None = None
    twist_id: str | None = None
    node_id: str | None = None


# ── Across the books of a series (v1.5) ─────────────────────────────────────────


class BookScene(BaseModel):
    """A scene of another book of the series, by its place in the series."""

    position: int
    story_id: str
    node_id: str | None = None
    title: str = ""


class BookStep(BaseModel):
    """What one book does with a thread or twist: the Across the series fold, a column of the
    series tapestry."""

    position: int
    story_id: str
    #: The thread's or twist's row in that book.
    ref_id: str
    #: A thread's roles there, in reading order ("opens", "moves", ..., "closes").
    roles: list[str] = []
    #: A twist's clues there, toward the truth and away from it, and its reveal scene.
    toward: int = 0
    away: int = 0
    reveal: str | None = None
    set_aside: bool = False
    #: First and last scenes it is in there.
    first: str = ""
    last: str = ""


class PromiseAcross(BaseModel):
    """A thread or twist of this book that is a series element: where it stands across the books."""

    element_id: str
    #: The earliest earlier book with scenes for it ("Carried from Book 1").
    from_book: int | None = None
    #: Still open after this book and a later book has it ("Continues in Book 3").
    continues_in: int | None = None
    #: Where a thread closes or a twist is revealed, when that is another book.
    resolved_in: BookScene | None = None
    revealed_in: BookScene | None = None
    books: list[BookStep] = []


class ComingInItem(BaseModel):
    """Something the reader brings into this book from an earlier one."""

    text: str
    #: clue | reveal | you
    source: str
    #: Its place in the series: the book it came from.
    book: int
    #: The twist it belongs to, as this book's own row when this book has it.
    twist_id: str | None = None
    #: A belief this book overturns: the scene that does it.
    overturned_at: str | None = None


class ComingIn(BaseModel):
    """What the reader knows at the start of this book (decision 5)."""

    learned: list[ComingInItem] = []
    believes: list[ComingInItem] = []
    only: list[ComingInItem] = []


class EarlierOpen(BaseModel):
    """A thread or twist the earlier books left open: still a question when this book begins."""

    kind: str  # thread | twist
    element_id: str
    name: str
    #: This book's row of it, when it has one.
    ref_id: str | None = None
    #: The book it began in, and the last that moved it.
    opened_book: int
    last_book: int
    #: What it last did ("turns", "3 clues"), in the author's words.
    last: str = ""
    #: A twist's truth, and what its clues have said so far.
    truth: str = ""
    clues: list[str] = []


class PromisesOut(BaseModel):
    scenes: list[PromiseScene]
    chapters: list[PromiseChapter]
    threads: list[PromiseThread]
    twists: list[PromiseTwist]
    setups: list[Setup]
    reader: list[ReaderRow]
    checks: list[PromiseCheck]
    #: In a series: this book's place in it (from 0) and the series' id.
    book: int | None = None
    series_id: str | None = None
    #: Thread and twist id -> where it stands across the books.
    across: dict[str, PromiseAcross] = {}
    coming_in: ComingIn | None = None
    open_from_earlier: list[EarlierOpen] = []
