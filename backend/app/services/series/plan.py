"""A series planned from the start (series v2): books before they are written, each book's
part, the arc across the books and what changes from book to book.

A planned book is an ordinary story with no words yet: every tool that works on a book
works on it, and starting to write it is just opening it. Nothing here commits.
"""

from __future__ import annotations

import copy
import uuid

from sqlalchemy.orm import Session

from ...models.series import Series, SeriesStory
from ...models.story import Story
from .. import change_log
from .service import INHERITED_STORY_FIELDS, SeriesError, attach_story, lift_element, positions

#: What an axis can be, and the series kind of what fills it (a custom axis is words only).
AXIS_KINDS: dict[str, str | None] = {"character": "character", "era": "era", "location": "location", "custom": None}


def _nearest_earlier(series: Series, position: int) -> Story | None:
    books = sorted(series.books, key=lambda b: b.position)
    earlier = [b for b in books if b.position < position]
    return earlier[-1].story if earlier else (books[0].story if books else None)


def add_planned_book(
    db: Session,
    series: Series,
    title: str,
    *,
    position: int | None = None,
    role: str = "",
) -> SeriesStory:
    """A new book in the series, not yet started: told the way the book before it is (or the
    first book, when it goes at the front), with no outline until the author makes one."""
    title = title.strip()
    if not title:
        raise SeriesError("A book needs a title.")
    at = len(series.books) if position is None else max(0, min(position, len(series.books)))
    story = Story(user_id=series.user_id, title=title)
    source = _nearest_earlier(series, at)
    if source is not None:
        for key in INHERITED_STORY_FIELDS:
            setattr(story, key, copy.deepcopy(getattr(source, key)))
    db.add(story)
    db.flush()
    book = attach_story(db, series, story, at)
    book.role = role
    db.flush()
    return book


def book_of(series: Series, story_id: str) -> SeriesStory:
    book = next((b for b in series.books if b.story_id == story_id), None)
    if book is None:
        raise SeriesError("That book is not in this series.", 404)
    return book


def book_number(series: Series, story_id: str) -> int:
    return positions(series)[story_id] + 1


# ── The arc ──────────────────────────────────────────────────────────────────────


def set_arc(series: Series, beats: list[dict]) -> None:
    """The series' arc as given, in order: new beats get ids, and a beat taken out is taken off
    every book that carried it. The series' own shape, so not undoable (as its order is not)."""
    arc: list[dict] = []
    for beat in beats:
        name = (beat.get("name") or "").strip()
        if not name:
            raise SeriesError("Every beat of the arc needs a name.")
        arc.append(
            {"id": beat.get("id") or str(uuid.uuid4()), "name": name, "description": beat.get("description") or ""}
        )
    if len({b["id"] for b in arc}) != len(arc):
        raise SeriesError("The arc lists the same beat twice.")
    kept = {b["id"] for b in arc}
    series.arc = arc
    for book in series.books:
        if any(bid not in kept for bid in book.arc_beats or []):
            book.arc_beats = [bid for bid in book.arc_beats if bid in kept]


# ── What changes from book to book ───────────────────────────────────────────────


def set_axes(series: Series, axes: list[dict]) -> None:
    """The series' axes as given: what changes from book to book. An axis taken out leaves
    every book's place on it; only a character axis can be the one each book is seen
    through. The series' own shape, so not undoable."""
    out: list[dict] = []
    for axis in axes:
        kind, label = axis.get("kind"), (axis.get("label") or "").strip()
        if kind not in AXIS_KINDS:
            raise SeriesError(f"A series cannot change by {kind!r} from book to book.")
        if not label:
            raise SeriesError("Every axis needs a name.")
        out.append(
            {
                "id": axis.get("id") or str(uuid.uuid4()),
                "kind": kind,
                "label": label,
                "pov": bool(axis.get("pov")) and kind == "character",
            }
        )
    if len({a["id"] for a in out}) != len(out):
        raise SeriesError("The axes list the same one twice.")
    kept = {a["id"] for a in out}
    series.axes = out
    for book in series.books:
        if any(k not in kept for k in book.slots or {}):
            book.slots = {k: v for k, v in book.slots.items() if k in kept}


def _slot(db: Session, series: Series, axis: dict, value: dict) -> dict:
    """One book's place on one axis, from what the author chose: a series element, a row of
    a book (shared with the series now), or an idea in words."""
    kind = AXIS_KINDS[axis["kind"]]
    if value.get("element_id") or value.get("ref_id"):
        if kind is None:
            raise SeriesError(f"“{axis['label']}” is written in words, not chosen from the Lorebook.")
        if value.get("element_id"):
            element = next((e for e in series.elements if e.id == value["element_id"]), None)
            if element is None:
                raise SeriesError("That is not in this series.", 404)
        else:
            element = lift_element(db, series, kind, value.get("story_id") or "", value["ref_id"])
        if element.kind != kind:
            raise SeriesError(f"“{axis['label']}” takes a {kind.replace('_', ' ')}, not a {element.kind}.")
        return {"element_id": element.id, "text": element.name}
    return {"element_id": None, "text": (value.get("text") or "").strip()}


def _slots(db: Session, series: Series, book: SeriesStory, changes: dict) -> dict:
    axes = {a["id"]: a for a in series.axes or []}
    out = dict(book.slots or {})
    for axis_id, value in changes.items():
        if axis_id not in axes:
            raise SeriesError("That axis is not in this series.", 404)
        slot = _slot(db, series, axes[axis_id], value) if value else None
        if slot is None or (not slot["element_id"] and not slot["text"]):
            out.pop(axis_id, None)
        else:
            out[axis_id] = slot
    return out


# ── A book's part ────────────────────────────────────────────────────────────────

#: What the Chronicle calls each part of a book's plan.
_PLAN_WORDS = {"role": "part", "arc_beats": "arc beats", "slots": "place on the axes"}


def update_book(
    db: Session,
    series: Series,
    story_id: str,
    data: dict,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> None:
    """A book's own part of the plan: what it does in the series, the arc beats it carries,
    where it stands on each axis. Undoable in that book, like any other edit to it (sharing
    a row with the series, to stand on an axis, is the series' and stays)."""
    book = book_of(series, story_id)
    if "slots" in data:
        data["slots"] = _slots(db, series, book, data["slots"])
    if "arc_beats" in data:
        known = {b["id"] for b in series.arc or []}
        if any(bid not in known for bid in data["arc_beats"]):
            raise SeriesError("That beat is not in the series' arc.")
        data["arc_beats"] = list(dict.fromkeys(data["arc_beats"]))
    words = ", ".join(_PLAN_WORDS[k] for k in data if k in _PLAN_WORDS)
    change_log.record_update(
        db,
        book,
        data,
        entity_type="series_story",
        story_id=story_id,
        label=f"Edit this book's {words} in “{series.name}”",
        actor_id=actor_id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(book, key, value)
    db.flush()
