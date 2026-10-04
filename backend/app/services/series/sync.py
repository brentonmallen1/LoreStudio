"""Shared research, kept in step (series doc, v1.5).

A research entry, image or diagram shared with a series is in every book of it, each book
holding its own copy (and its own file), so a book stays whole on its own: exported,
restored or deleted, it never reaches into another. What keeps them one entry is this: an
edit to any copy is made to every other, each book logging its own change, so undo in any
book takes back that book's and is itself kept in step. The last edit wins.

Never a finding, never carried over by choice: shared research is simply everywhere.
Nothing here commits.
"""

from __future__ import annotations

import copy
from typing import Any

from sqlalchemy.orm import Session

from ...models.media import StoryAsset
from ...models.series import Series, SeriesElement
from .. import change_log
from ..media_files import give_own_file, uploads_dir
from . import service
from .kinds import SERIES_KINDS, SYNCED_KINDS, SeriesKind, kind_for_table


def _book_label(series: Series, story_id: str) -> str:
    pos = service.positions(series)
    return f"Book {pos[story_id] + 1}" if story_id in pos else "another book"


def push(
    db: Session,
    element: SeriesElement,
    source_story_id: str,
    fields: list[str] | None = None,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> list[str]:
    """``source_story_id``'s copy, made every other copy: each book logs its own change.
    Returns the books changed."""
    kind = SERIES_KINDS[element.kind]
    series = element.series
    source = service.member_in(element, source_story_id)
    src = service.member_row(db, source) if source else None
    if src is None:
        return []
    refs = dict(kind.refs)
    keys = [f for f in (fields or [*kind.fields, *refs]) if f in kind.fields or f in refs]
    changed = []
    for m in element.members:
        row = service.member_row(db, m) if m.story_id != source_story_id else None
        if row is None:
            continue
        data: dict[str, Any] = {}
        for key in keys:
            value = getattr(src, key)
            data[key] = (
                service.local_equivalent(db, series, refs[key], value, m.story_id)
                if key in refs
                else copy.deepcopy(value)
            )
        if not change_log.record_update(
            db,
            row,
            data,
            entity_type=kind.kind,
            story_id=m.story_id,
            label=f"Keep {element.name} in step with {_book_label(series, source_story_id)}",
            actor_id=actor_id,
            client_id=client_id,
        ):
            continue
        for key, value in data.items():
            setattr(row, key, value)
        changed.append(m.story_id)
    db.flush()
    return changed


def _synced_element(db: Session, table: str, row_id: str) -> tuple[SeriesKind, SeriesElement] | None:
    kind = kind_for_table(table)
    if kind is None or not kind.synced:
        return None
    element = service.element_for_row(db, table, row_id)
    return (kind, element) if element is not None else None


def after_write(
    db: Session, table: str, row, fields: list[str], *, actor_id: str | None, client_id: str | None
) -> list[str]:
    """A copy of shared research was edited: every other book's copy follows."""
    found = _synced_element(db, table, row.id)
    if found is None:
        return []
    return push(db, found[1], row.story_id, fields, actor_id=actor_id, client_id=client_id)


def after_new_file(db: Session, asset: StoryAsset) -> None:
    """A shared image or document has a new file: every other book's copy gets the same
    bytes, each in a file of its own. Files are not undoable, here as anywhere."""
    found = _synced_element(db, "story_assets", asset.id)
    if found is None:
        return
    for m in found[1].members:
        other = service.member_row(db, m) if m.story_id != asset.story_id else None
        if other is None:
            continue
        old = uploads_dir() / other.stored_path if other.stored_path else None
        give_own_file(asset, other)
        other.original_filename, other.mime_type, other.size_bytes = (
            asset.original_filename,
            asset.mime_type,
            asset.size_bytes,
        )
        if old is not None and old.is_file() and old != uploads_dir() / other.stored_path:
            old.unlink()
    db.flush()


def keep_in_step(db: Session, row_ids: list[str], *, actor_id: str | None, client_id: str | None) -> None:
    """After an undo, redo or restore touched these rows: any that are shared research put
    the other books' copies where they now are."""
    for kind_name in SYNCED_KINDS:
        kind = SERIES_KINDS[kind_name]
        for row in db.query(kind.model).filter(kind.model.id.in_(row_ids)).all() if row_ids else []:
            after_write(db, kind.table, row, [], actor_id=actor_id, client_id=client_id)


def after_restore(db: Session, story_id: str) -> None:
    """A book restored from a snapshot: its shared research is what every book now says."""
    book = service.membership(db, story_id)
    if book is None:
        return
    for element in book.series.elements:
        mine = service.member_in(element, story_id) if element.kind in SYNCED_KINDS else None
        if mine is not None and service.member_row(db, mine) is not None:
            push(db, element, story_id, actor_id=None, client_id=None)


def share(
    db: Session,
    series: Series,
    kind_name: str,
    story_id: str,
    ref_id: str,
    *,
    actor_id: str | None,
    client_id: str | None,
    log: bool = True,
) -> SeriesElement:
    """Share a book's research with the series: a copy in every other book, each logged in
    its book. A document entry shares its file first, so each copy holds its own."""
    kind = service.kind_of(kind_name)
    if not kind.synced:
        raise service.SeriesError(f"A {kind.label.lower()} is shared through the Canon, not as research.")
    row = db.get(kind.model, ref_id)
    if row is None or row.story_id != story_id:
        raise service.SeriesError(f"No such {kind.label.lower()} in that book.", 404)
    for column, ref_kind in kind.refs:
        if getattr(row, column):
            share(db, series, ref_kind, story_id, getattr(row, column), actor_id=actor_id, client_id=client_id, log=log)
    element = service.lift_element(db, series, kind.kind, story_id, ref_id)
    for book in sorted(series.books, key=lambda b: b.position):
        if service.member_in(element, book.story_id) is None:
            service.adopt_into_book(db, series, element, book.story_id, actor_id=actor_id, client_id=client_id, log=log)
    return element


def adopt_shared(db: Session, series: Series, story_id: str) -> None:
    """A book joining a series takes the research it shares, files before the entries."""
    order = list(SERIES_KINDS)
    for element in sorted(series.elements, key=lambda e: order.index(e.kind) if e.kind in order else 99):
        if element.kind in SYNCED_KINDS and element.members and service.member_in(element, story_id) is None:
            service.adopt_into_book(db, series, element, story_id, actor_id=None, client_id=None, log=False)


def in_step(db: Session, element: SeriesElement) -> bool:
    """Every book's copy says the same, a blank included (unlike canon, where silence agrees)."""
    from ..findings.fingerprint import normalise

    kind = SERIES_KINDS[element.kind]
    rows = [r for m in element.members if (r := service.member_row(db, m)) is not None]
    return all(len({normalise(str(getattr(r, f) or "")) for r in rows}) <= 1 for f in kind.fields)
