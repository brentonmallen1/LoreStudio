"""Proposals › Imported (doc 28): what an import brought with no home chosen yet.

Each waiting item is a proposal with the homes it could have: a character, a place, a thread,
a trope, a system, a culture, an event, a note, or the Compendium. Placing one makes that row
and records it, so it undoes; "Don't need it" marks the item declined, which undoes too. The
item stays either way, so the import's record still says where everything went.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.compendium import CompendiumAttachment, CompendiumEntry
from ...models.culture import Culture
from ...models.historical_event import HistoricalEvent
from ...models.import_record import ImportedItem, ImportRecord
from ...models.location import Location
from ...models.media import AssetAttachment
from ...models.note import Note
from ...models.plot_thread import PlotThread
from ...models.trope import Trope
from ...models.world_system import WorldSystem
from ...schemas.proposals import ActResult, Proposal, ProposalAction
from .. import change_log
from ..color_slots import next_slot

#: action id -> (label, table, entity type)
HOMES: dict[str, tuple[str, str, str]] = {
    "compendium": ("Keep in Compendium", "compendium_entries", "compendium_entry"),
    "character": ("Make a character", "characters", "character"),
    "place": ("Make a place", "locations", "location"),
    "thread": ("Make a thread", "plot_threads", "plot_thread"),
    "trope": ("Make a trope", "tropes", "trope"),
    "system": ("Make a world system", "world_systems", "world_system"),
    "culture": ("Make a culture", "cultures", "culture"),
    "event": ("Make a historical event", "historical_events", "historical_event"),
    "note": ("Make a note", "notes", "note"),
}
SOURCE_LABELS = {"novelcrafter": "Novelcrafter", "document": "a document", "script": "a script"}

#: What a kind of item most likely is: its first homes after the Compendium.
_LIKELY = {
    "lore": ("system", "event", "culture"),
    "other": ("note", "character", "place"),
    "location": ("place",),
    "character": ("character",),
    "subplot": ("thread",),
    "object": ("note",),
    "snippet": ("note",),
}


def _actions(item: ImportedItem) -> list[ProposalAction]:
    likely = _LIKELY.get(item.origin_type, ("note",))
    order = ["compendium", *likely, *(h for h in HOMES if h != "compendium" and h not in likely)]
    return [ProposalAction(id=h, label=HOMES[h][0], primary=h == "compendium") for h in order]


def where(record: ImportRecord) -> str:
    at = record.imported_at
    return f"From {SOURCE_LABELS.get(record.source, record.source)}, {at.day} {at:%b}"


def imported_proposals(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    records = {r.id: r for r in db.query(ImportRecord).filter(ImportRecord.story_id == story_id)}
    rows = (
        db.query(ImportedItem)
        .filter(ImportedItem.story_id == story_id, ImportedItem.status == "waiting")
        .order_by(ImportedItem.position)
        .all()
    )
    out = []
    for item in rows:
        record = records.get(item.record_id)
        out.append(
            Proposal(
                id=f"imported:{item.id}",
                kind="imported",
                source="local",
                text=f"“{item.name}” came with the import and has no home yet",
                subject=item.name,
                evidence=item.content,
                where=where(record) if record else "",
                actions=_actions(item),
                decline="Don't need it",
                created_at=record.imported_at if record else item.created_at,
                group=item.record_id,
            )
        )
    return out


def _attach(db: Session, item: ImportedItem, object_type: str, object_id: str, batch: str, ctx: dict) -> None:
    """The item's image and links, onto what it became."""
    rows = []
    asset_id = (item.raw or {}).get("thumbnail_asset_id")
    if asset_id and object_type in ("character", "location"):
        rows.append(
            (
                AssetAttachment(asset_id=asset_id, object_type=object_type, object_id=object_id, role="portrait"),
                "asset_attachments",
                "asset_attachment",
            )
        )
    for link_id in (item.raw or {}).get("link_entry_ids") or []:
        rows.append(
            (
                CompendiumAttachment(entry_id=link_id, object_type=object_type, object_id=object_id),
                "compendium_attachments",
                "compendium_attachment",
            )
        )
    for obj, table, entity_type in rows:
        db.add(obj)
        db.flush()
        change_log.record_row_create(db, obj, table, entity_type=entity_type, batch_id=batch, **ctx)


def _make(story_id: str, item: ImportedItem, home: str, db: Session):
    name, body = item.name, item.content or ""
    if home == "compendium":
        asset = (item.raw or {}).get("thumbnail_asset_id")
        return CompendiumEntry(
            story_id=story_id, entry_type="note", title=name, content=body, tags=item.tags or [], asset_id=asset
        )
    if home == "character":
        slot = next_slot(s for (s,) in db.query(Character.color_slot).filter(Character.story_id == story_id))
        return Character(story_id=story_id, name=name, background=body, color_slot=slot)
    if home == "place":
        return Location(story_id=story_id, name=name, description=body)
    if home == "thread":
        slot = next_slot(s for (s,) in db.query(PlotThread.color_slot).filter(PlotThread.story_id == story_id))
        return PlotThread(story_id=story_id, name=name, description=body, color_slot=slot)
    if home == "trope":
        position = db.query(Trope).filter(Trope.story_id == story_id).count()
        return Trope(story_id=story_id, name=name, why=body, position=position)
    if home == "system":
        return WorldSystem(story_id=story_id, name=name, notes=body)
    if home == "culture":
        return Culture(story_id=story_id, name=name, description=body)
    if home == "event":
        return HistoricalEvent(story_id=story_id, name=name, description=body)
    return Note(story_id=story_id, kind="note", content=f"{name}\n\n{body}".strip(), source="import")


def place(
    story_id: str, item: ImportedItem, home: str, db: Session, actor: str, client: str | None, batch: str | None = None
) -> ActResult:
    """Make the row the author chose for the item, and mark it placed; one undoable batch."""
    if home not in HOMES:
        raise ValueError(f"No such home: {home}")
    label, table, entity_type = HOMES[home]
    batch = batch or str(uuid.uuid4())
    ctx = {"story_id": story_id, "actor_id": actor, "client_id": client, "label": f"{label}: {item.name}"}
    row = _make(story_id, item, home, db)
    row.id = str(uuid.uuid4())
    db.add(row)
    db.flush()
    change_log.record_row_create(db, row, table, entity_type=entity_type, batch_id=batch, **ctx)
    object_type = {"character": "character", "place": "location", "thread": "thread"}.get(home)
    if object_type:
        _attach(db, item, object_type, row.id, batch, ctx)
    _settle(db, item, "placed", entity_type, row.id, batch, ctx)
    return ActResult(entity_type=entity_type, entity_id=row.id)


def decline_item(
    story_id: str, item: ImportedItem, db: Session, actor: str, client: str | None, batch: str | None = None
) -> None:
    ctx = {"story_id": story_id, "actor_id": actor, "client_id": client, "label": f"Not needed: {item.name}"}
    _settle(db, item, "declined", None, None, batch or str(uuid.uuid4()), ctx)


def _settle(
    db: Session, item: ImportedItem, status: str, kind: str | None, row_id: str | None, batch: str, ctx: dict
) -> None:
    data = {"status": status, "became_type": kind, "became_id": row_id}
    change_log.record_update(db, item, data, entity_type="imported_item", batch_id=batch, **ctx)
    for key, value in data.items():
        setattr(item, key, value)
    # When it was sorted is bookkeeping, not part of what undo puts back.
    item.sorted_at = datetime.now(UTC)
    db.flush()


def settle_rest(story_id: str, record_id: str, how: str, db: Session, actor: str, client: str | None) -> int:
    """Every item from one import still waiting: kept in the Compendium, or declined; one batch."""
    batch = str(uuid.uuid4())
    items = (
        db.query(ImportedItem)
        .filter(
            ImportedItem.record_id == record_id, ImportedItem.story_id == story_id, ImportedItem.status == "waiting"
        )
        .order_by(ImportedItem.position)
        .all()
    )
    for item in items:
        if how == "compendium":
            place(story_id, item, "compendium", db, actor, client, batch=batch)
        else:
            decline_item(story_id, item, db, actor, client, batch=batch)
    db.commit()
    return len(items)
