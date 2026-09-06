"""Server-side change log: the source of truth for undo and redo (refactor decision D5).

Every mutating route that wants to be undoable calls :func:`record` (or the
``capture_*`` helpers for deletes) inside the same transaction as the write.
Undo applies the inverse and records that as a new change with ``undo_of`` set;
redo re-applies and records ``redo_of``. The log is never edited.

Undo is per client (browser tab) by default: you reverse what *you* did, not what
another tab did a second ago. Passing ``client_id=None`` reverses the latest
change regardless of origin (the Activity page uses this).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import Header
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.change import Change
from ..models.character import Character, CharacterRelationship
from ..models.dialogue import DialogueBlock
from ..models.interview import CharacterInterview
from ..models.location import Location, SceneSetting
from ..models.outline import Outline, OutlineItem
from ..models.plot_thread import PlotThreadAppearance
from ..models.scene_link import SceneLink
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.todo import StoryTodo

#: entity_type -> model. Deletes capture a bundle of rows keyed by table name.
ENTITY_MODELS: dict[str, type] = {
    "structure_node": StructureNode,
    "character": Character,
    "character_relationship": CharacterRelationship,
    "outline": Outline,
    "outline_item": OutlineItem,
    "story": Story,
    "location": Location,
    "todo": StoryTodo,
}

#: Tables inside a delete bundle, in insert order (parents first).
BUNDLE_MODELS: dict[str, type] = {
    "locations": Location,
    "structure_nodes": StructureNode,
    "scene_settings": SceneSetting,
    "scene_links": SceneLink,
    "plot_thread_appearances": PlotThreadAppearance,
    "dialogue_blocks": DialogueBlock,
    "characters": Character,
    "character_relationships": CharacterRelationship,
    "character_interviews": CharacterInterview,
    "outlines": Outline,
    "outline_items": OutlineItem,
    "story_todos": StoryTodo,
}

RETENTION_ROWS_PER_STORY = 10_000


class UndoConflict(Exception):
    """The entity no longer looks like it did after the change being reversed."""


def _as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value) -> list:
    return value if isinstance(value, list) else []


def _entity_model(entity_type: str) -> type:
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        raise UndoConflict(f"Unknown entity type {entity_type!r}")
    return model


@dataclass
class UndoResult:
    label: str
    entity_type: str
    entity_ids: list[str]
    batch_id: str


def get_client_id(x_client_id: str | None = Header(default=None)) -> str | None:
    """FastAPI dependency: the browser tab id sent as ``X-Client-Id``."""
    return x_client_id


# ── Serialisation ────────────────────────────────────────────────────────────────


def _row(obj) -> dict:
    from .snapshot_service import _model_to_dict

    return _model_to_dict(obj)


def _model(model_class, data: dict):
    from .snapshot_service import _dict_to_model

    return _dict_to_model(model_class, data)


def diff_fields(before_obj, patch: dict[str, Any]) -> tuple[dict, dict]:
    """(before, after) restricted to keys whose value actually changes."""
    before: dict = {}
    after: dict = {}
    for key, new in patch.items():
        old = getattr(before_obj, key, None)
        if old != new:
            before[key] = _jsonable(old)
            after[key] = _jsonable(new)
    return before, after


def _jsonable(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


# ── Recording ────────────────────────────────────────────────────────────────────


def record(
    db: Session,
    *,
    story_id: str | None,
    entity_type: str,
    entity_id: str,
    action: str,
    before,
    after,
    label: str,
    actor_id: str | None,
    client_id: str | None,
    batch_id: str | None = None,
    undoable: bool = True,
    undo_of: str | None = None,
    redo_of: str | None = None,
) -> Change:
    """Append one change row. Call inside the caller's transaction (no commit here)."""
    change = Change(
        story_id=story_id,
        batch_id=batch_id or str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before=before,
        after=after,
        label=label,
        actor_id=actor_id,
        client_id=client_id,
        undoable=undoable,
        undo_of=undo_of,
        redo_of=redo_of,
    )
    db.add(change)
    return change


def capture_node_tree(node: StructureNode, db: Session) -> dict[str, list[dict]]:
    """Everything a deleted node takes with it, as plain rows keyed by table."""
    nodes: list[StructureNode] = []

    def walk(n: StructureNode) -> None:
        nodes.append(n)
        for c in sorted(n.children or [], key=lambda x: x.position):
            walk(c)

    walk(node)
    ids = [n.id for n in nodes]
    return {
        "structure_nodes": [_row(n) for n in nodes],
        "scene_settings": [_row(s) for s in db.query(SceneSetting).filter(SceneSetting.node_id.in_(ids)).all()],
        "scene_links": [
            _row(link)
            for link in db.query(SceneLink)
            .filter((SceneLink.source_node_id.in_(ids)) | (SceneLink.target_node_id.in_(ids)))
            .all()
        ],
        "plot_thread_appearances": [
            _row(a) for a in db.query(PlotThreadAppearance).filter(PlotThreadAppearance.node_id.in_(ids)).all()
        ],
        "dialogue_blocks": [_row(b) for b in db.query(DialogueBlock).filter(DialogueBlock.scene_id.in_(ids)).all()],
    }


def capture_character(character: Character, db: Session) -> dict[str, list[dict]]:
    rels = (
        db.query(CharacterRelationship)
        .filter(
            (CharacterRelationship.character_id == character.id)
            | (CharacterRelationship.related_character_id == character.id)
        )
        .all()
    )
    interviews = db.query(CharacterInterview).filter(CharacterInterview.character_id == character.id).all()
    return {
        "characters": [_row(character)],
        "character_relationships": [_row(r) for r in rels],
        "character_interviews": [_row(i) for i in interviews],
    }


def capture_location(location: Location, db: Session) -> dict[str, list[dict]]:
    rows: list[Location] = []

    def walk(loc: Location) -> None:
        rows.append(loc)
        for c in loc.children or []:
            walk(c)

    walk(location)
    ids = [r.id for r in rows]
    return {
        "locations": [_row(r) for r in rows],
        "scene_settings": [_row(s) for s in db.query(SceneSetting).filter(SceneSetting.location_id.in_(ids)).all()],
    }


def record_update(db: Session, obj, data: dict, *, entity_type: str, story_id: str, label: str, actor_id, client_id):
    """Diff ``data`` against ``obj`` and record an update if anything changes. Returns the after-dict."""
    before, after = diff_fields(obj, data)
    if before:
        record(
            db,
            story_id=story_id,
            entity_type=entity_type,
            entity_id=obj.id,
            action="update",
            before=before,
            after=after,
            label=label.format(fields=", ".join(sorted(after))),
            actor_id=actor_id,
            client_id=client_id,
        )
    return after


def record_row_delete(
    db: Session, obj, table: str, *, entity_type: str, story_id: str, label: str, actor_id, client_id
):
    """Record the deletion of one row that has no dependants."""
    record(
        db,
        story_id=story_id,
        entity_type=entity_type,
        entity_id=obj.id,
        action="delete",
        before={table: [_row(obj)]},
        after=None,
        label=label,
        actor_id=actor_id,
        client_id=client_id,
    )


def record_row_create(
    db: Session, obj, table: str, *, entity_type: str, story_id: str, label: str, actor_id, client_id
):
    record(
        db,
        story_id=story_id,
        entity_type=entity_type,
        entity_id=obj.id,
        action="create",
        before=None,
        after={table: [_row(obj)]},
        label=label,
        actor_id=actor_id,
        client_id=client_id,
    )


def capture_outline(outline: Outline, db: Session) -> dict[str, list[dict]]:
    items = db.query(OutlineItem).filter(OutlineItem.outline_id == outline.id).all()
    return {"outlines": [_row(outline)], "outline_items": [_row(i) for i in items]}


# ── Applying inverses ────────────────────────────────────────────────────────────


def _insert_bundle(bundle: dict[str, list[dict]], db: Session) -> None:
    from .snapshot_service import _insert_ordered_tree

    for table, model in BUNDLE_MODELS.items():
        rows = bundle.get(table) or []
        if not rows:
            continue
        if table in ("structure_nodes", "outline_items"):
            _insert_ordered_tree(model, rows, db)
        else:
            for r in rows:
                db.add(_model(model, r))
            db.flush()


def _delete_bundle(bundle: dict[str, list[dict]], db: Session) -> None:
    # Children first: reverse insert order.
    for table, model in reversed(list(BUNDLE_MODELS.items())):
        ids = [r["id"] for r in (bundle.get(table) or [])]
        if ids:
            db.query(model).filter(getattr(model, "id").in_(ids)).delete(synchronize_session=False)
    db.flush()


def _apply_fields(model, entity_id: str, expected: dict | None, values: dict, db: Session) -> None:
    obj = db.get(model, entity_id)
    if obj is None:
        raise UndoConflict("The item no longer exists.")
    if expected:
        for key, val in expected.items():
            if _jsonable(getattr(obj, key, None)) != val:
                raise UndoConflict(f"'{key}' changed since then; undo skipped to protect the newer edit.")
    for key, val in values.items():
        col = getattr(type(obj), key).property.columns[0].type if hasattr(type(obj), key) else None
        if col is not None and col.__class__.__name__ == "DateTime" and isinstance(val, str):
            from datetime import datetime

            val = datetime.fromisoformat(val)
        setattr(obj, key, val)
    db.flush()


def reorder_snapshot(model, ids: list[str], db: Session) -> list[dict]:
    """Current parent/position/level of the given rows (for before/after of a reorder)."""
    rows = db.query(model).filter(getattr(model, "id").in_(ids)).all() if ids else []
    return [
        {k: getattr(r, k) for k in ("id", "parent_id", "position", "level") if hasattr(r, k)}
        for r in sorted(rows, key=lambda r: ids.index(r.id))
    ]


def _apply_reorder(model, ops: list[dict], db: Session) -> None:
    for op in ops:
        row = db.get(model, op["id"])
        if not row:
            continue
        for key in ("parent_id", "position", "level"):
            if key in op and hasattr(row, key):
                setattr(row, key, op[key])
    db.flush()


def _capture_current(model, entity_id: str, db: Session) -> dict[str, list[dict]] | None:
    """Fresh rows for an entity about to be removed by undo-of-create (children may have been added since)."""
    obj = db.get(model, entity_id)
    if obj is None:
        return None
    if model is StructureNode:
        return capture_node_tree(obj, db)
    if model is Character:
        return capture_character(obj, db)
    if model is Outline:
        return capture_outline(obj, db)
    if model is Location:
        return capture_location(obj, db)
    table = next((t for t, m in BUNDLE_MODELS.items() if m is model), None)
    return {table: [_row(obj)]} if table else None


def _reverse(change: Change, db: Session) -> dict | None:
    """Undo one change row. Returns the bundle removed by an undo-of-create, for redo."""
    model = _entity_model(change.entity_type)
    if change.action == "update":
        _apply_fields(model, change.entity_id, _as_dict(change.after), _as_dict(change.before), db)
    elif change.action == "create":
        bundle = _capture_current(model, change.entity_id, db)
        obj = db.get(model, change.entity_id)
        if obj is not None:
            db.delete(obj)  # ORM delete: cascades to children added after the create
            db.flush()
        return bundle
    elif change.action == "delete":
        _insert_bundle(_as_dict(change.before), db)
    elif change.action == "reorder":
        _apply_reorder(model, _as_list(change.before), db)
    return None


def _reapply(change: Change, db: Session, undo_row: Change | None = None) -> None:
    """Redo one change row (the original, not the undo row)."""
    model = _entity_model(change.entity_type)
    if change.action == "update":
        _apply_fields(model, change.entity_id, _as_dict(change.before), _as_dict(change.after), db)
    elif change.action == "create":
        # Prefer what the undo actually removed (it may include later-added children).
        bundle = (undo_row.before if undo_row and isinstance(undo_row.before, dict) else None) or _as_dict(change.after)
        _insert_bundle(bundle, db)
    elif change.action == "delete":
        _delete_bundle(_as_dict(change.before), db)
    elif change.action == "reorder":
        _apply_reorder(model, _as_list(change.after), db)


# ── Finding what to undo / redo ──────────────────────────────────────────────────


def _batches(db: Session, story_id: str, client_id: str | None):
    q = db.query(Change).filter(Change.story_id == story_id)
    if client_id:
        q = q.filter(Change.client_id == client_id)
    return q


def _latest_normal_batch(db: Session, story_id: str, client_id: str | None) -> list[Change] | None:
    """Newest undoable batch (original or redo) that has not been undone."""
    undone = {
        row[0] for row in db.query(Change.undo_of).filter(Change.story_id == story_id, Change.undo_of.isnot(None)).all()
    }
    q = (
        _batches(db, story_id, client_id)
        .filter(Change.undoable.is_(True), Change.undo_of.is_(None))
        .order_by(Change.seq.desc())
    )
    for change in q.limit(200).all():
        if change.batch_id not in undone:
            return db.query(Change).filter(Change.batch_id == change.batch_id).order_by(Change.seq).all()
    return None


def _latest_undo_batch(db: Session, story_id: str, client_id: str | None) -> list[Change] | None:
    """Newest undo batch not yet redone, provided no normal change came after it."""
    redone = {
        row[0] for row in db.query(Change.redo_of).filter(Change.story_id == story_id, Change.redo_of.isnot(None)).all()
    }
    latest_undo = (
        _batches(db, story_id, client_id).filter(Change.undo_of.isnot(None)).order_by(Change.seq.desc()).limit(50).all()
    )
    for change in latest_undo:
        if change.batch_id in redone:
            continue
        newer_normal = (
            _batches(db, story_id, client_id)
            .filter(Change.undo_of.is_(None), Change.undoable.is_(True), Change.seq > change.seq)
            .count()
        )
        if newer_normal:
            return None  # a fresh edit cleared the redo stack
        return db.query(Change).filter(Change.batch_id == change.batch_id).order_by(Change.seq).all()
    return None


def undo_latest(db: Session, story_id: str, actor_id: str | None, client_id: str | None) -> UndoResult | None:
    batch = _latest_normal_batch(db, story_id, client_id)
    if not batch:
        return None
    undo_batch_id = str(uuid.uuid4())
    for change in reversed(batch):
        removed = _reverse(change, db)
        record(
            db,
            story_id=story_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            action=f"undo:{change.action}",
            before=removed if removed is not None else change.after,
            after=change.before,
            label=f"Undo {change.label}",
            actor_id=actor_id,
            client_id=client_id,
            batch_id=undo_batch_id,
            undo_of=change.batch_id,
        )
    db.commit()
    return UndoResult(batch[0].label, batch[0].entity_type, [c.entity_id for c in batch], undo_batch_id)


def redo_latest(db: Session, story_id: str, actor_id: str | None, client_id: str | None) -> UndoResult | None:
    undo_batch = _latest_undo_batch(db, story_id, client_id)
    if not undo_batch:
        return None
    original = db.query(Change).filter(Change.batch_id == undo_batch[0].undo_of).order_by(Change.seq).all()
    redo_batch_id = str(uuid.uuid4())
    undo_by_entity = {(u.entity_type, u.entity_id): u for u in undo_batch}
    for change in original:
        _reapply(change, db, undo_by_entity.get((change.entity_type, change.entity_id)))
        record(
            db,
            story_id=story_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            action=change.action,
            before=change.before,
            after=change.after,
            label=change.label,
            actor_id=actor_id,
            client_id=client_id,
            batch_id=redo_batch_id,
            redo_of=undo_batch[0].batch_id,
        )
    db.commit()
    return UndoResult(original[0].label, original[0].entity_type, [c.entity_id for c in original], redo_batch_id)


def undo_state(db: Session, story_id: str, client_id: str | None) -> dict:
    nb = _latest_normal_batch(db, story_id, client_id)
    ub = _latest_undo_batch(db, story_id, client_id)
    return {
        "can_undo": nb is not None,
        "undo_label": nb[0].label if nb else None,
        "can_redo": ub is not None,
        "redo_label": ub[0].label.removeprefix("Undo ") if ub else None,
    }


def prune(db: Session, story_id: str, keep: int = RETENTION_ROWS_PER_STORY) -> int:
    total = db.query(func.count(Change.seq)).filter(Change.story_id == story_id).scalar() or 0
    excess = total - keep
    if excess <= 0:
        return 0
    cutoff = (
        db.query(Change.seq).filter(Change.story_id == story_id).order_by(Change.seq).offset(excess).limit(1).scalar()
    )
    deleted = db.query(Change).filter(Change.story_id == story_id, Change.seq < cutoff).delete()
    db.commit()
    return deleted


def prune_all(db: Session, keep: int = RETENTION_ROWS_PER_STORY) -> int:
    """Startup housekeeping: cap the log per story. Returns rows removed."""
    story_ids = [row[0] for row in db.query(Change.story_id).filter(Change.story_id.isnot(None)).distinct().all()]
    return sum(prune(db, sid, keep) for sid in story_ids)
