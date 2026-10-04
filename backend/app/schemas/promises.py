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


class PromisesOut(BaseModel):
    scenes: list[PromiseScene]
    chapters: list[PromiseChapter]
    threads: list[PromiseThread]
    twists: list[PromiseTwist]
    setups: list[Setup]
    reader: list[ReaderRow]
    checks: list[PromiseCheck]
