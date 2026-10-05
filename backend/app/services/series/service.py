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
from .kinds import (
    NOT_COPIED,
    PROMISE_KINDS,
    SERIES_KINDS,
    SeriesKind,
    field_class,
    field_words,
    kind_for_table,
    name_of,
)


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
    # Research the series shares is in every book of it, this one now too.
    from .sync import adopt_shared

    adopt_shared(db, series, story.id)
    return book


def has_plan(series: Series) -> bool:
    """Whether the series says something of its own: a premise, an intent, an arc or axes. A
    series like that is worth keeping with no books in it; one that only grouped books is not."""
    return any(((series.premise or "").strip(), (series.intent or "").strip(), series.arc, series.axes))


def detach_story(db: Session, story_id: str) -> None:
    """Take a book out of its series. Its rows stay in it, now its own; the links go, and so
    do its setups that pay off in another book.

    An element left in no book goes, and so does a series left with no books, unless it has
    a plan of its own (``has_plan``): that one waits for its next book.
    """
    book = membership(db, story_id)
    if book is None:
        return
    series = book.series
    for member in db.query(SeriesElementMember).filter(SeriesElementMember.story_id == story_id).all():
        member.element.members.remove(member)
        db.delete(member)
    # Setups that pay off in another book join this book to that one: they go with it.
    for link in list(series.scene_links):
        if story_id in (link.source_story_id, link.target_story_id):
            series.scene_links.remove(link)
            db.delete(link)
    series.books.remove(book)
    db.delete(book)
    db.flush()
    gc_elements(db, series)
    if not series.books and not has_plan(series):
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
    element = SeriesElement(kind=kind.kind, name=name_of(row, kind))
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
    if kind.after_copy is not None:
        kind.after_copy(db, src, row)
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


def _carry_images(db: Session, kind: SeriesKind, src, row) -> list[tuple[Any, str, str]]:
    """A character's or place's portrait and reference images, copied with it: each a file of
    its own in the new book, so a portrait can change from book to book. As (row, table, type)."""
    from ...models.media import AssetAttachment, StoryAsset
    from ..media_files import copy_asset

    made: list[tuple[Any, str, str]] = []
    for att in (
        db.query(AssetAttachment)
        .filter(AssetAttachment.object_type == kind.kind, AssetAttachment.object_id == src.id)
        .all()
    ):
        asset = db.get(StoryAsset, att.asset_id)
        if asset is None:
            continue
        mine = copy_asset(db, asset, row.story_id)
        link = AssetAttachment(asset_id=mine.id, object_type=kind.kind, object_id=row.id, role=att.role)
        db.add(link)
        db.flush()
        made += [(mine, "story_assets", "story_asset"), (link, "asset_attachments", "asset_attachment")]
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
    log: bool = True,
):
    """Bring an element into a book, starting from where it last stood. Undoable in that book,
    unless ``log`` is off (a new book's carry-over: making the book is not undoable either)."""
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
    images = _carry_images(db, kind, src, row) if kind.kind in ("character", "location") else []
    if not log:
        return row

    batch_id = batch_id or str(uuid.uuid4())
    label = f"Bring {element.name} into this book from the series"
    for obj, table, entity_type in (
        (row, kind.table, kind.kind),
        (member, "series_element_members", "series_element_member"),
        *((r, "character_relationships", "character_relationship") for r in rels),
        *images,
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
        raise SeriesError(f"{name_of(row, kind)} is already a series element.", 409)
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


# ── The next book ────────────────────────────────────────────────────────────────

#: What a sequel takes from the book before it: how the books are told, not what happens.
INHERITED_STORY_FIELDS = (
    "structure_template_id",
    "genre",
    "tone",
    "themes",
    "target_audience",
    "intended_length",
    "narrative_perspective",
    "author_name",
)


def _promise_state(row) -> str:
    """Where one book leaves a thread or twist: "done" (closed, revealed or set aside),
    "open" (it has scenes and is not done) or "planned" (no scenes in this book)."""
    if getattr(row, "set_aside", False):
        return "done"
    if isinstance(row, SERIES_KINDS["plot_thread"].model):
        if any(a.role == "closes" for a in row.appearances):
            return "done"
        return "open" if row.appearances else "planned"
    if row.revealed_at_node_id:
        return "done"
    return "open" if any(c.node_id for c in row.clues) else "planned"


def promise_open_after(db: Session, series: Series | None, kind: SeriesKind, row, story_id: str) -> str:
    """Where a thread or twist stands at the end of ``story_id``, the books before it counted:
    done in any of them is done; open in any and not done is open; else planned."""
    states = [_promise_state(row)] if row is not None else []
    element = element_for_row(db, kind.table, row.id) if row is not None else None
    if series is not None and element is not None:
        pos = positions(series)
        here = pos.get(story_id, len(pos))
        for m in element.members:
            if m.story_id != story_id and pos.get(m.story_id, here) < here and (other := member_row(db, m)) is not None:
                states.append(_promise_state(other))
    if "done" in states:
        return "done"
    return "open" if "open" in states else "planned"


def _element_open_after(db: Session, series: Series, element: SeriesElement, story_id: str) -> str:
    pos = positions(series)
    here = pos.get(story_id, len(pos))
    states = [
        _promise_state(row)
        for m in element.members
        if pos.get(m.story_id, here) < here and (row := member_row(db, m)) is not None
    ]
    if "done" in states:
        return "done"
    return "open" if "open" in states else "planned"


def carry_candidates(db: Session, story: Story) -> list[dict]:
    """Everything a sequel to ``story`` could start with: this book's rows of every series
    kind, and the series' elements this book does not have (they come from an earlier book).

    Threads and twists are offered only while still open, and those with scenes behind them
    come ticked (``preselect``): a question the books have asked and not answered is the one
    a sequel most easily drops. What the series already shares comes ticked too.
    """
    book = membership(db, story.id)
    series = book.series if book else None
    out: list[dict] = []
    for kind in SERIES_KINDS.values():
        if kind.synced:
            continue
        promise = kind.kind in PROMISE_KINDS
        name_col = getattr(kind.model, kind.name_attr)
        rows = db.query(kind.model).filter(kind.model.story_id == story.id).order_by(name_col).all()
        for row in rows:
            if getattr(row, "is_stub", False):
                continue
            state = promise_open_after(db, series, kind, row, story.id) if promise else ""
            if state == "done":
                continue
            element = element_for_row(db, kind.table, row.id)
            out.append(
                {
                    "kind": kind.kind,
                    "ref_id": row.id,
                    "element_id": element.id if element else None,
                    "name": name_of(row, kind),
                    "in_series": element is not None,
                    "parent_ref_id": getattr(row, "parent_id", None),
                    "preselect": state == "open" if promise else element is not None,
                }
            )
        if series is None:
            continue
        for element in sorted(series.elements, key=lambda e: e.name.lower()):
            if element.kind != kind.kind or member_in(element, story.id) is not None or not element.members:
                continue
            state = _element_open_after(db, series, element, story.id) if promise else ""
            if state == "done":
                continue
            out.append(
                {
                    "kind": kind.kind,
                    "ref_id": None,
                    "element_id": element.id,
                    "name": element.name,
                    "in_series": True,
                    "parent_ref_id": None,
                    "preselect": state == "open" if promise else True,
                }
            )
    return out


def _depth(row, by_id: dict) -> int:
    depth, seen = 0, set()
    while getattr(row, "parent_id", None) and row.parent_id in by_id and row.id not in seen:
        seen.add(row.id)
        row = by_id[row.parent_id]
        depth += 1
    return depth


def start_next_book(
    db: Session,
    source: Story,
    new_story: Story,
    carry: list[dict],
    *,
    series_name: str | None = None,
) -> Series:
    """Make ``new_story`` the book after ``source``: the series made if there is none (named
    after the first book), the book placed next, how the books are told carried over, and
    each chosen element shared and brought in from where it last stood.

    ``carry`` items are ``{"kind", "ref_id"}`` (a row of ``source``) or ``{"element_id"}``
    (a series element ``source`` does not have).
    """
    book = membership(db, source.id)
    series = book.series if book else create_series(db, source.user_id, series_name or source.title)
    if book is None:
        attach_story(db, series, source)
    for key in INHERITED_STORY_FIELDS:
        setattr(new_story, key, copy.deepcopy(getattr(source, key)))
    attach_story(db, series, new_story, positions(series)[source.id] + 1)

    carry_into(db, series, source, new_story.id, carry, log=False)
    return series


def carry_into(
    db: Session,
    series: Series,
    source: Story,
    target_id: str,
    carry: list[dict],
    *,
    log: bool = True,
    actor_id: str | None = None,
    client_id: str | None = None,
) -> list[SeriesElement]:
    """Bring the chosen elements into ``target_id``, each from where it last stood: rows of
    ``source`` are shared first. What the book already has is passed by. With ``log``, all of
    them are one undo in that book (a planned book given its cast later).

    ``carry`` items are ``{"kind", "ref_id"}`` (a row of ``source``) or ``{"element_id"}``
    (a series element ``source`` does not have).
    """
    elements: list[SeriesElement] = []
    rows: list[tuple[SeriesKind, Any]] = []
    for item in carry:
        if item.get("element_id"):
            element = next((e for e in series.elements if e.id == item["element_id"]), None)
            if element is None:
                raise SeriesError("That element is not in this series.", 404)
            elements.append(element)
        else:
            kind = kind_of(item.get("kind") or "")
            row = db.get(kind.model, item.get("ref_id"))
            if row is None or row.story_id != source.id:
                raise SeriesError(f"No such {kind.label.lower()} in “{source.title}”.", 404)
            rows.append((kind, row))
    # Parents before children, eras before their events, so each copy can find its own.
    locations = {r.id: r for k, r in rows if k.kind == "location"}
    order = list(SERIES_KINDS)
    rows.sort(key=lambda kr: (order.index(kr[0].kind), _depth(kr[1], locations)))
    for kind, row in rows:
        elements.append(lift_element(db, series, kind.kind, source.id, row.id))
    seen: set[str] = set()
    batch_id = str(uuid.uuid4())
    for element in sorted(elements, key=lambda e: order.index(e.kind)):
        if element.id in seen or member_in(element, target_id) is not None:
            continue
        seen.add(element.id)
        adopt_into_book(
            db, series, element, target_id, actor_id=actor_id, client_id=client_id, batch_id=batch_id, log=log
        )
    return [e for e in series.elements if e.id in seen]


# ── Keeping canon straight ───────────────────────────────────────────────────────


def propagate_field(
    db: Session,
    series: Series,
    element: SeriesElement,
    field: str,
    source_story_id: str,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> list[str]:
    """One book's value of an enduring field, made the value in every book that has the
    element. Each book logs its own edit (undo is per book). Returns the books changed."""
    kind = kind_of(element.kind)
    if field not in kind.fields:
        raise SeriesError(f"A {kind.label.lower()} has no {field_words(field)}.")
    if field_class(kind, field, series.field_classes) != "enduring":
        raise SeriesError(f"The {field_words(field)} changes from book to book in this series; nothing to align.")
    source = member_in(element, source_story_id)
    src = member_row(db, source) if source else None
    if src is None:
        raise SeriesError(f"That book does not have {element.name}.", 404)
    value = getattr(src, field)
    changed = []
    for m in element.members:
        if m.story_id == source_story_id:
            continue
        row = member_row(db, m)
        if row is None or getattr(row, field) == value:
            continue
        change_log.record_update(
            db,
            row,
            {field: value},
            entity_type=kind.kind,
            story_id=m.story_id,
            label=f"Make {element.name}'s {field_words(field)} the series' one",
            actor_id=actor_id,
            client_id=client_id,
        )
        setattr(row, field, copy.deepcopy(value))
        changed.append(m.story_id)
    db.flush()
    return changed


def set_field_class(series: Series, kind_name: str, field: str, cls: str | None) -> None:
    """Say a field stays true across this series, or changes book to book; None: the default."""
    kind = kind_of(kind_name)
    if kind.synced:
        raise SeriesError("Shared research is the same in every book: none of it changes book to book.")
    if field not in kind.fields:
        raise SeriesError(f"A {kind.label.lower()} has no {field_words(field)}.")
    if cls not in (None, "enduring", "evolving"):
        raise SeriesError("A field either stays true or changes from book to book.")
    overrides = {k: dict(v) for k, v in (series.field_classes or {}).items()}
    mine = overrides.setdefault(kind.kind, {})
    default = "enduring" if field in kind.enduring else "evolving"
    if cls is None or cls == default:
        mine.pop(field, None)
    else:
        mine[field] = cls
    series.field_classes = {k: v for k, v in overrides.items() if v}


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
        if latest is None or (row := alive.get((latest.ref_table, latest.ref_id))) is None:
            continue
        name = name_of(row, kind_for_table(latest.ref_table))
        if name and name != e.name:
            e.name = name
    db.flush()
    gc_elements(db, series)
    return pruned


def tidy(db: Session, series: Series) -> None:
    """What every series endpoint does first."""
    from .setups import prune_links

    prune_dead_members(db, series)
    prune_links(db, series)
