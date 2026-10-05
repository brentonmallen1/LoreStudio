"""Series shapes (series v2): ready-made starts for a series' plan.

A shape is a number of books, an arc of turning points placed on them, a part for each book
and, for some, what changes from book to book. Applying one fills what is empty and adds
what is missing; it never changes a book's words, a part already written or an arc already
drawn. Constants, not rows: a shape is a suggestion, and the plan it leaves is the author's.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ...models.series import Series
from .plan import add_planned_book, set_arc, set_axes
from .service import SeriesError


@dataclass(frozen=True)
class Shape:
    id: str
    name: str
    summary: str
    #: The part each book plays, in order; the shape's number of books.
    roles: tuple[str, ...]
    #: Turning points of the arc: (name, what happens, the books that carry it, from 0).
    arc: tuple[tuple[str, str, tuple[int, ...]], ...]
    #: What changes from book to book: (kind, label, seen through).
    axes: tuple[tuple[str, str, bool], ...] = field(default=())


SHAPES: tuple[Shape, ...] = (
    Shape(
        "duology",
        "Duology",
        "Two books: the first gives an answer that will not hold, the second pays for it.",
        (
            "Asks the question, and gives an answer that will not hold.",
            "Pays for that answer, and finds the true one.",
        ),
        (
            ("The question is asked", "What the two books are about, raised so it cannot be put down.", (0,)),
            ("The first answer", "It looks like the end; it is the mistake the second book undoes.", (0,)),
            ("The cost comes due", "What the first answer broke, and who pays.", (1,)),
            ("The true answer", "The ending the first book only seemed to reach.", (1,)),
        ),
    ),
    Shape(
        "trilogy",
        "Trilogy",
        "Three books: a beginning, a widening that turns dark, and an ending the first book promised.",
        (
            "Sets out the world and its question; wins something, and loses more than it knows.",
            "Widens everything, and takes the story to its darkest turn.",
            "Gathers what is left, and keeps the promise the first book made.",
        ),
        (
            ("The world and its question", "Who, where, and what is wrong.", (0,)),
            ("A victory that hides a loss", "The first book ends; the series has only begun.", (0,)),
            ("Everything widens", "More people, more ground, higher stakes.", (1,)),
            ("The darkest turn", "What the first book won is lost.", (1,)),
            ("Gathering what is left", "Old threads pulled tight for the last time.", (2,)),
            ("The promised ending", "The question the first book asked, answered.", (2,)),
        ),
    ),
    Shape(
        "saga",
        "Open-ended saga",
        "As many books as the story wants: each closes its own question, one long question runs under all.",
        ("Opens the long question, and answers a smaller one of its own.",),
        (
            ("The long question opens", "What the whole saga is about, glimpsed.", (0,)),
            ("This book's own answer", "A question of its own, closed, so the book stands alone.", (0,)),
        ),
    ),
    Shape(
        "viewpoint-cycle",
        "A viewpoint each book",
        "One story told again and onward through different eyes: each book is seen through someone new.",
        (
            "Seen through the first pair of eyes: what they believe happened.",
            "Seen through someone the first book misread.",
            "Seen through someone who was there all along.",
            "Seen through the last pair of eyes, who changes what the first book meant.",
        ),
        (
            ("The shared event", "What every viewpoint will have to account for.", (0,)),
            ("Each viewpoint changes the truth", "What only this character could see.", (1, 2)),
            ("The last eyes reframe the first", "The first book read again.", (3,)),
        ),
        (("character", "Viewpoint", True),),
    ),
    Shape(
        "generational",
        "Generational saga",
        "A family or a place across generations: each book a different time, seen through a different heir.",
        (
            "The first generation, and the wound it leaves.",
            "The second, who inherits it without being told.",
            "The third, who finally reckons with it.",
        ),
        (
            ("The founding wound", "What was done, and kept quiet.", (0,)),
            ("The inheritance", "What the next generation carries without knowing it.", (1,)),
            ("The reckoning", "The secret surfaces, and the family decides what it is.", (2,)),
        ),
        (("character", "Viewpoint", True), ("era", "Era", False)),
    ),
)

BY_ID = {s.id: s for s in SHAPES}

_ORDINALS = ("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth")


def _working_title(n: int) -> str:
    """A planned book's title until it has one: "The second book", not "Book 2" twice over."""
    return f"The {_ORDINALS[n]} book" if n < len(_ORDINALS) else f"Book {n + 1}"


def preview(shape: Shape, series: Series) -> dict:
    """What applying the shape would do here, in numbers, before it does it."""
    have = {(a["kind"], a["label"].lower()) for a in series.axes or []}
    return {
        "books": max(0, len(shape.roles) - len(series.books)),
        "beats": len(shape.arc),
        "axes": [label for kind, label, _ in shape.axes if (kind, label.lower()) not in have],
    }


def apply(db: Session, series: Series, shape_id: str) -> dict:
    """Fill the series' plan from a shape: planned books up to its count, its arc placed on
    them, the axes it is missing, and a part for each book that has none. An arc already
    drawn is the author's: the shape is refused rather than mixed into it."""
    shape = BY_ID.get(shape_id)
    if shape is None:
        raise SeriesError("There is no such shape.", 404)
    if series.arc:
        raise SeriesError("This series already has an arc; a shape only starts one.", 409)
    done = preview(shape, series)
    for n in range(len(series.books), len(shape.roles)):
        add_planned_book(db, series, _working_title(n))
    books = sorted(series.books, key=lambda b: b.position)
    for book, role in zip(books, shape.roles, strict=False):
        if not (book.role or "").strip():
            book.role = role
    set_arc(series, [{"name": name, "description": what} for name, what, _ in shape.arc])
    for beat, (_, _, on) in zip(series.arc, shape.arc, strict=True):
        for i in on:
            if i < len(books):
                books[i].arc_beats = [*(books[i].arc_beats or []), beat["id"]]
    have = {(a["kind"], a["label"].lower()) for a in series.axes or []}
    extra = [
        {"kind": kind, "label": label, "pov": pov}
        for kind, label, pov in shape.axes
        if (kind, label.lower()) not in have
    ]
    if extra:
        set_axes(series, [*(series.axes or []), *extra])
    db.flush()
    return done
