"""Series: books in order, and the elements they share (series doc).

An element is a chain of ordinary rows, one per book that has it. Bringing it into a book
copies the nearest earlier book's row (or the nearest later one, for a prequel), so the new
book starts from where the element last stood and every single-book feature works on it
unchanged. Nothing here commits: callers own the transaction.
"""

from __future__ import annotations

import copy
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ...models.character import CharacterRelationship
from ...models.series import Series, SeriesElement, SeriesElementMember, SeriesStory
from ...models.story import Story
from .. import change_log
from .kinds import NOT_COPIED, SERIES_KINDS, SeriesKind, kind_for_table


class SeriesError(Exception):
    """A request the series cannot honour, said in the author's words."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


# ── Books ────────────────────────────────────────────────────────────────────────


def membership(db: Session, story_id: str) -> SeriesStory | None:
    return db.query(SeriesStory).filter(SeriesStory.story_id == story_id).first()


def positions(series: Series) -> dict[str, int]:
    """story_id -> its place in the series, from 0."""
    return {b.story_id: i for i, b in enumerate(sorted(series.books, key=lambda b: b.position))}


def _renumber(series: Series) -> None:
    for i, book in enumerate(sorted(series.books, key=lambda b: b.position)):
        book.position = i


def create_series(db: Session, user_id: str, name: str, *, premise: str = "", intent: str = "") -> Series:
    name = name.strip()
    if not name:
        raise SeriesError("A series needs a name.")
    series = Series(user_id=user_id, name=name, premise=premise, intent=intent, field_classes={})
    db.add(series)
    db.flush()
    return series


def attach_story(db: Session, series: Series, story: Story, position: int | None = None) -> SeriesStory:
    existing = membership(db, story.id)
    if existing is not None:
        if existing.series_id == series.id:
            return existing
        raise SeriesError(
            f"“{story.title}” is already a book in “{existing.series.name}”. A book belongs to one series; "
            "take it out of that one first.",
            409,
        )
    books = sorted(series.books, key=lambda b: b.position)
    at = len(books) if position is None else max(0, min(position, len(books)))
    for b in books[at:]:
        b.position += 1
    book = SeriesStory(story_id=story.id, position=at)
    series.books.append(book)
    db.flush()
    _renumber(series)
    return book


def detach_story(db: Session, story_id: str) -> None:
    """Take a book out of its series. Its rows stay in it, now its own; the links go.

    An element left in no book goes, and so does a series left with no books.
    """
    book = membership(db, story_id)
    if book is None:
        return
    series = book.series
    for member in db.query(SeriesElementMember).filter(SeriesElementMember.story_id == story_id).all():
        member.element.members.remove(member)
        db.delete(member)
    series.books.remove(book)
    db.delete(book)
    db.flush()
    gc_elements(db, series)
    if not series.books:
        db.delete(series)
    else:
        _renumber(series)
    db.flush()


def reorder(db: Session, series: Series, story_ids: list[str]) -> None:
    current = {b.story_id: b for b in series.books}
    if sorted(story_ids) != sorted(current):
        raise SeriesError("The new order must list every book in the series once.")
    for i, sid in enumerate(story_ids):
        current[sid].position = i
    db.flush()


# ── Elements ─────────────────────────────────────────────────────────────────────


def kind_of(name: str) -> SeriesKind:
    kind = SERIES_KINDS.get(name)
    if kind is None:
        raise SeriesError(f"A series cannot share a {name!r}.")
    return kind


def member_row(db: Session, member: SeriesElementMember):
    kind = kind_for_table(member.ref_table)
    return db.get(kind.model, member.ref_id) if kind else None


def element_for_row(db: Session, table: str, ref_id: str) -> SeriesElement | None:
    member = (
        db.query(SeriesElementMember)
        .filter(SeriesElementMember.ref_table == table, SeriesElementMember.ref_id == ref_id)
        .first()
    )
    return member.element if member else None


def member_in(element: SeriesElement, story_id: str) -> SeriesElementMember | None:
    return next((m for m in element.members if m.story_id == story_id), None)


def _require_book(series: Series, story_id: str) -> None:
    if story_id not in positions(series):
        raise SeriesError("That book is not in this series.", 404)


def lift_element(db: Session, series: Series, kind_name: str, story_id: str, ref_id: str) -> SeriesElement:
    """Share one book's row with the series. Already shared: that element, unchanged."""
    kind = kind_of(kind_name)
    _require_book(series, story_id)
    row = db.get(kind.model, ref_id)
    if row is None or row.story_id != story_id:
        raise SeriesError(f"No such {kind.label.lower()} in that book.", 404)
    existing = element_for_row(db, kind.table, ref_id)
    if existing is not None:
        return existing
    element = SeriesElement(kind=kind.kind, name=row.name)
    series.elements.append(element)
    element.members.append(SeriesElementMember(story_id=story_id, ref_table=kind.table, ref_id=ref_id))
    db.flush()
    return element


def source_member(series: Series, element: SeriesElement, story_id: str) -> SeriesElementMember | None:
    """The member a book should start from: the nearest earlier book's, else the nearest later one's."""
    pos = positions(series)
    here = pos.get(story_id, len(pos))
    others = [m for m in element.members if m.story_id != story_id and m.story_id in pos]
    earlier = [m for m in others if pos[m.story_id] < here]
    if earlier:
        return max(earlier, key=lambda m: pos[m.story_id])
    later = [m for m in others if pos[m.story_id] > here]
    return min(later, key=lambda m: pos[m.story_id]) if later else None


def local_equivalent(db: Session, series: Series, kind_name: str, ref_id: str | None, story_id: str) -> str | None:
    """The row in ``story_id`` that is the same element as ``ref_id``, if that book has it."""
    if not ref_id:
        return None
    element = element_for_row(db, SERIES_KINDS[kind_name].table, ref_id)
    if element is None or element.series_id != series.id:
        return None
    member = member_in(element, story_id)
    return member.ref_id if member else None


def copy_row(db: Session, series: Series, kind: SeriesKind, src, story_id: str):
    """A new row in ``story_id`` with ``src``'s values: the element as it last stood."""
    data = {
        attr.key: copy.deepcopy(getattr(src, attr.key))
        for attr in kind.model.__mapper__.column_attrs
        if attr.key not in NOT_COPIED
    }
    data.update(copy.deepcopy(kind.fresh))
    for column, ref_kind in kind.refs:
        data[column] = local_equivalent(db, series, ref_kind, data.get(column), story_id)
    row = kind.model(id=str(uuid.uuid4()), story_id=story_id, **data)
    db.add(row)
    db.flush()
    return row


def _carry_relationships(db: Session, series: Series, src_id: str, new_id: str, story_id: str) -> list:
    """Relationships of ``src_id`` whose other end is already in ``story_id``, copied there."""
    made = []
    rels = (
        db.query(CharacterRelationship)
        .filter((CharacterRelationship.character_id == src_id) | (CharacterRelationship.related_character_id == src_id))
        .all()
    )
    for rel in rels:
        outgoing = rel.character_id == src_id
        other = local_equivalent(
            db, series, "character", rel.related_character_id if outgoing else rel.character_id, story_id
        )
        if other is None:
            continue
        a, b = (new_id, other) if outgoing else (other, new_id)
        exists = (
            db.query(CharacterRelationship)
            .filter(CharacterRelationship.character_id == a, CharacterRelationship.related_character_id == b)
            .first()
        )
        if exists:
            continue
        data = {
            attr.key: copy.deepcopy(getattr(rel, attr.key))
            for attr in sa_inspect(CharacterRelationship).mapper.column_attrs
            if attr.key not in NOT_COPIED and attr.key not in ("character_id", "related_character_id")
        }
        copy_rel = CharacterRelationship(id=str(uuid.uuid4()), character_id=a, related_character_id=b, **data)
        db.add(copy_rel)
        made.append(copy_rel)
    db.flush()
    return made


def adopt_into_book(
    db: Session,
    series: Series,
    element: SeriesElement,
    story_id: str,
    *,
    actor_id: str | None,
    client_id: str | None,
    batch_id: str | None = None,
):
    """Bring an element into a book, starting from where it last stood. Undoable in that book."""
    _require_book(series, story_id)
    if member_in(element, story_id) is not None:
        raise SeriesError(f"{element.name} is already in that book.", 409)
    kind = kind_of(element.kind)
    source = source_member(series, element, story_id)
    src = member_row(db, source) if source else None
    if src is None:
        raise SeriesError(f"No book has {element.name} to start from.", 404)
    row = copy_row(db, series, kind, src, story_id)
    member = SeriesElementMember(story_id=story_id, ref_table=kind.table, ref_id=row.id)
    element.members.append(member)
    db.flush()
    rels = _carry_relationships(db, series, src.id, row.id, story_id) if kind.kind == "character" else []

    batch_id = batch_id or str(uuid.uuid4())
    label = f"Bring {element.name} into this book from the series"
    for obj, table, entity_type in (
        (row, kind.table, kind.kind),
        (member, "series_element_members", "series_element_member"),
        *((r, "character_relationships", "character_relationship") for r in rels),
    ):
        change_log.record(
            db,
            story_id=story_id,
            entity_type=entity_type,
            entity_id=obj.id,
            action="create",
            before=None,
            after={table: [change_log._row(obj)]},
            label=label,
            actor_id=actor_id,
            client_id=client_id,
            batch_id=batch_id,
        )
    return row


def link_existing(db: Session, series: Series, element: SeriesElement, story_id: str, ref_id: str) -> None:
    """Say a row this book already has is the series element (the retrofit case)."""
    _require_book(series, story_id)
    kind = kind_of(element.kind)
    row = db.get(kind.model, ref_id)
    if row is None or row.story_id != story_id:
        raise SeriesError(f"No such {kind.label.lower()} in that book.", 404)
    if member_in(element, story_id) is not None:
        raise SeriesError(f"That book already has {element.name}.", 409)
    if element_for_row(db, kind.table, ref_id) is not None:
        raise SeriesError(f"{row.name} is already a series element.", 409)
    element.members.append(SeriesElementMember(story_id=story_id, ref_table=kind.table, ref_id=ref_id))
    db.flush()


def unlink_member(db: Session, series: Series, element: SeriesElement, story_id: str) -> None:
    """This book's row stops being the series element; it stays in the book as its own."""
    member = member_in(element, story_id)
    if member is None:
        raise SeriesError(f"{element.name} is not in that book.", 404)
    element.members.remove(member)
    db.delete(member)
    db.flush()
    gc_elements(db, series)


def unlift(db: Session, series: Series, element: SeriesElement) -> None:
    """The element stops being shared: every book keeps its own row, and the link goes."""
    for member in list(element.members):
        db.delete(member)
    db.delete(element)
    db.flush()
    db.expire(series, ["elements"])


# ── Housekeeping ─────────────────────────────────────────────────────────────────


def gc_elements(db: Session, series: Series) -> int:
    """Elements no book has any more go. Returns how many."""
    gone = [e for e in series.elements if not e.members]
    for e in gone:
        series.elements.remove(e)
        db.delete(e)
    db.flush()
    return len(gone)


def prune_dead_members(db: Session, series: Series) -> int:
    """Forget members whose row was deleted in its book, and refresh element names.

    Called by the series endpoints only: the findings and proposals readers skip a dead
    member instead, because a read must not write.
    """
    by_table: dict[str, list[SeriesElementMember]] = defaultdict(list)
    for e in series.elements:
        for m in e.members:
            by_table[m.ref_table].append(m)
    alive: dict[tuple[str, str], Any] = {}
    for table, members in by_table.items():
        kind = kind_for_table(table)
        if kind is None:
            continue
        for row in db.query(kind.model).filter(kind.model.id.in_([m.ref_id for m in members])).all():
            alive[(table, row.id)] = row
    pruned = 0
    for members in by_table.values():
        for m in members:
            if (m.ref_table, m.ref_id) not in alive or alive[(m.ref_table, m.ref_id)].story_id != m.story_id:
                m.element.members.remove(m)
                db.delete(m)
                pruned += 1
    pos = positions(series)
    for e in series.elements:
        latest = max(e.members, key=lambda m: pos.get(m.story_id, -1), default=None)
        row = alive.get((latest.ref_table, latest.ref_id)) if latest else None
        if row is not None and row.name != e.name:
            e.name = row.name
    db.flush()
    gc_elements(db, series)
    return pruned


def tidy(db: Session, series: Series) -> None:
    """What every series endpoint does first."""
    prune_dead_members(db, series)
