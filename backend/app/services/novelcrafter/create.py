"""Making a Novelcrafter export's Lorebook, notes and conversations in the new story (doc 28).

Runs after the manuscript is made, in the same request. Every entry, snippet and chat ends in
exactly one place: a row it became (in the record's manifest), an imported item waiting in
Proposals › Imported, or the record's list of what was left out and why.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.chat_message import ChatMessage
from ...models.chat_session import ChatSession
from ...models.compendium import CompendiumAttachment, CompendiumEntry
from ...models.culture import Culture
from ...models.historical_event import HistoricalEvent
from ...models.import_record import ImportedItem, ImportRecord
from ...models.location import Location
from ...models.media import AssetAttachment, StoryAsset
from ...models.note import Note
from ...models.plot_thread import PlotThread
from ...models.story import Story
from ...models.trope import Trope
from ...models.world_system import WorldSystem
from ...schemas.import_novelcrafter import NcEntryChoice, SnippetTarget
from ..color_slots import next_slot
from ..media_files import write_upload
from .mapping import ROLE_TAGS, THEME_TAGS, TROPE_TAGS
from .reader import IMAGE_TYPES, Entry, Export

#: Notes the import writes say where they came from (Note.source: who wrote it, when not the author).
SOURCE = "novelcrafter"


def _join(*parts: str) -> str:
    return "\n\n".join(p.strip() for p in parts if p and p.strip())


def _body(e: Entry) -> str:
    """An entry's words, its notes and any custom fields, so nothing in it is dropped."""
    fields = "\n".join(f"{k}: {v}" for k, v in e.fields.items())
    return _join(e.body, f"Notes:\n{e.notes}" if e.notes else "", fields)


def _when(date: str, i: int = 0) -> datetime:
    try:
        base = datetime.fromisoformat(date).replace(tzinfo=UTC)
    except ValueError:
        base = datetime.now(UTC)
    return base + timedelta(seconds=i)


class _Maker:
    def __init__(self, export: Export, story: Story, user_id: str, record: ImportRecord, db: Session):
        self.export, self.story, self.user_id, self.record, self.db = export, story, user_id, record, db
        self.by_id = {e.id: e for e in export.entries}
        self.made: dict[str, tuple[str, Any]] = {}  # entry id -> (type, row)
        self.assets: dict[str, StoryAsset] = {}
        self.links: dict[str, list[CompendiumEntry]] = {}
        self.items = 0

    def add(self, obj):
        self.db.add(obj)
        self.db.flush()
        return obj

    def became(self, origin: str, name: str, kind: str, row_id: str | None) -> None:
        self.record.manifest = [
            *self.record.manifest,
            {"origin": origin, "name": name, "became_type": kind, "became_id": row_id},
        ]

    # ── What every entry brings: its image, its links ──
    def prepare(self, e: Entry) -> None:
        if e.thumbnail:
            ext = "." + e.thumbnail_name.rsplit(".", 1)[-1].lower()
            asset = StoryAsset(
                id=str(uuid.uuid4()),
                story_id=self.story.id,
                user_id=self.user_id,
                original_filename=f"{e.name}{ext}",
                stored_path="",
                mime_type=IMAGE_TYPES.get(ext, "image/jpeg"),
                size_bytes=len(e.thumbnail),
                alt_text=e.name,
                description="From Novelcrafter",
            )
            asset.stored_path = write_upload(self.story.id, asset.id, asset.original_filename, e.thumbnail)
            self.assets[e.id] = self.add(asset)
            self.became(f"{e.origin}/{e.thumbnail_name}", f"{e.name} (image)", "image", asset.id)
        for url in e.urls:
            host = urlparse(url).netloc or url
            entry = CompendiumEntry(
                story_id=self.story.id,
                entry_type="url",
                title=f"{e.name}: {host}",
                url=url,
                tags=[e.name],
                category="research",
            )
            self.links.setdefault(e.id, []).append(self.add(entry))
            self.became(f"{e.origin}#{url}", entry.title, "link", entry.id)

    def attach(self, e: Entry, object_type: str, object_id: str, role: str = "portrait") -> None:
        """The entry's image and links, on the row it became (or folded into)."""
        if e.id in self.assets:
            self.add(
                AssetAttachment(asset_id=self.assets[e.id].id, object_type=object_type, object_id=object_id, role=role)
            )
        for link in self.links.get(e.id, []):
            self.add(CompendiumAttachment(entry_id=link.id, object_type=object_type, object_id=object_id))

    # ── Each target ──
    def character(self, e: Entry) -> Character:
        c = Character(story_id=self.story.id, name=e.name, aliases=e.aliases, background=_join(e.body, e.notes))
        for tag in e.tags:
            if mapped := ROLE_TAGS.get(tag.strip().lower()):
                setattr(c, *mapped)
        if e.fields:
            c.attributes = dict(e.fields)
        c.color_slot = next_slot(
            slot for (slot,) in self.db.query(Character.color_slot).filter(Character.story_id == self.story.id)
        )
        return self.add(c)

    def make(self, e: Entry, choice: NcEntryChoice) -> None:
        t, sid = choice.target, self.story.id
        row: object | None = None
        kind = t
        if t == "character":
            row = self.character(e)
            self.attach(e, "character", row.id)
        elif t == "location":
            row = self.add(Location(story_id=sid, name=e.name, aliases=e.aliases, description=_body(e)))
            self.attach(e, "location", row.id)
        elif t == "thread":
            slot = next_slot(s for (s,) in self.db.query(PlotThread.color_slot).filter(PlotThread.story_id == sid))
            row = self.add(PlotThread(story_id=sid, name=e.name, description=_body(e), color_slot=slot))
            self.attach(e, "thread", row.id, role="reference")
        elif t == "trope":
            other = [x for x in e.tags if x.strip().lower() not in TROPE_TAGS]
            definition = self.add(
                CompendiumEntry(
                    story_id=sid,
                    entry_type="note",
                    title=e.name,
                    content=_body(e),
                    tags=["Trope", *other],
                    category="craft",
                )
            )
            position = self.db.query(Trope).filter(Trope.story_id == sid).count()
            row = self.add(Trope(story_id=sid, name=e.name, definition_id=definition.id, position=position))
        elif t == "theme":
            if e.name not in (self.story.themes or []):
                self.story.themes = [*(self.story.themes or []), e.name]
            other = [x for x in e.tags if x.strip().lower() not in THEME_TAGS]
            row = self.add(
                CompendiumEntry(story_id=sid, entry_type="note", title=e.name, content=_body(e), tags=["Theme", *other])
            )
            kind = "compendium"
        elif t == "world_system":
            row = self.add(WorldSystem(story_id=sid, name=e.name, notes=_body(e)))
        elif t == "culture":
            row = self.add(Culture(story_id=sid, name=e.name, description=_body(e)))
        elif t == "historical_event":
            row = self.add(HistoricalEvent(story_id=sid, name=e.name, description=_body(e)))
        elif t == "compendium":
            row = self.add(
                CompendiumEntry(story_id=sid, entry_type="note", title=e.name, content=_body(e), tags=e.tags)
            )
            if e.id in self.assets:
                row.asset_id = self.assets[e.id].id
        elif t == "note":
            row = self.add(Note(story_id=sid, kind="note", content=_join(e.name, _body(e)), source=SOURCE))
        if row is not None:
            self.made[e.id] = (kind, row)
            self.became(e.origin, e.name, kind, row.id)

    def fold(self, e: Entry, choice: NcEntryChoice) -> None:
        """A facet into its character's field, or an entry into another's row."""
        if choice.target == "facet":
            owner = self.made.get(choice.facet_of or "")
            if owner is None or owner[0] != "character":
                return self.later(e)
            c: Character = owner[1]
            field = choice.facet_field or "note"
            if field == "note":
                note = self.add(
                    Note(
                        story_id=self.story.id,
                        kind="note",
                        content=_join(e.name, _body(e)),
                        about_type="character",
                        about_id=c.id,
                        source=SOURCE,
                    )
                )
                self.became(e.origin, e.name, "note", note.id)
            else:
                setattr(c, field, _join(getattr(c, field) or "", _body(e)))
                self.became(e.origin, e.name, f"character.{field}", c.id)
            self.attach(e, "character", c.id, role="reference")
            return None
        target = self.made.get(choice.merge_into or "")
        if target is None:
            return self.later(e)
        kind, row = target
        field = {"character": "background", "location": "description", "thread": "description"}.get(kind, "content")
        if hasattr(row, field):
            setattr(row, field, _join(getattr(row, field) or "", _join(e.name, _body(e))))
        if kind in ("character", "location"):
            self.attach(e, kind, row.id, role="reference")
        self.became(e.origin, e.name, f"{kind}.{field}", row.id)
        return None

    def later(self, e: Entry) -> None:
        raw = dict(e.raw)
        if e.id in self.assets:
            raw["thumbnail_asset_id"] = self.assets[e.id].id
        if e.id in self.links:
            raw["link_entry_ids"] = [c.id for c in self.links[e.id]]
        item = self.add(
            ImportedItem(
                story_id=self.story.id,
                record_id=self.record.id,
                origin=e.origin,
                origin_type=e.type,
                name=e.name,
                content=_body(e),
                tags=e.tags,
                raw=raw,
                position=self.items,
            )
        )
        self.items += 1
        self.became(e.origin, e.name, "imported_item", item.id)

    # ── Snippets and chats ──
    def snippet(self, s, target: SnippetTarget) -> None:
        title = s.title or "Snippet"
        if target == "logline":
            if not (self.story.logline or "").strip():
                self.story.logline = s.body.strip()
                return self.became(s.origin, title, "story.logline", self.story.id)
            target = "note"
        if target == "note":
            note = self.add(Note(story_id=self.story.id, kind="idea", content=_join(s.title, s.body), source=SOURCE))
            return self.became(s.origin, title, "note", note.id)
        if target == "compendium":
            body = s.body.strip()
            if body.startswith("http") and len(body.split()) == 1:
                entry = CompendiumEntry(
                    story_id=self.story.id, entry_type="url", title=title, url=body, category="research"
                )
            else:
                entry = CompendiumEntry(story_id=self.story.id, entry_type="note", title=title, content=body)
            self.add(entry)
            return self.became(s.origin, title, "compendium", entry.id)
        if target == "later":
            item = self.add(
                ImportedItem(
                    story_id=self.story.id,
                    record_id=self.record.id,
                    origin=s.origin,
                    origin_type="snippet",
                    name=title,
                    content=s.body,
                    raw={"title": s.title, "favourite": s.favourite, "date": s.date},
                    position=self.items,
                )
            )
            self.items += 1
            return self.became(s.origin, title, "imported_item", item.id)
        return None

    def chat(self, c) -> None:
        session = self.add(
            ChatSession(
                story_id=self.story.id,
                user_id=self.user_id,
                context_type="story",
                context_label=self.story.title,
                title=c.title or "From Novelcrafter",
                created_at=_when(c.date),
            )
        )
        for i, (role, text) in enumerate(c.turns):
            self.db.add(
                ChatMessage(
                    session_id=session.id,
                    role=role,
                    content=text,
                    model=SOURCE if role == "assistant" else None,
                    created_at=_when(c.date, i),
                )
            )
        self.db.flush()
        self.became(c.origin, session.title, "chat_session", session.id)


def create_from_export(
    export: Export,
    entries: dict[str, NcEntryChoice],
    snippets: dict[str, SnippetTarget],
    *,
    chats: bool,
    story: Story,
    user_id: str,
    record: ImportRecord,
    db: Session,
) -> None:
    """Everything the author chose to bring, made in ``story``; the record says where it went."""
    m = _Maker(export, story, user_id, record, db)
    for e in export.entries:
        m.prepare(e)
    folding = {"facet", "merge"}
    for e in export.entries:
        choice = entries.get(e.id) or NcEntryChoice(target="later")
        if choice.target == "later":
            m.later(e)
        elif choice.target == "skip":
            m.became(e.origin, e.name, "left_out", None)
        elif choice.target not in folding:
            m.make(e, choice)
    for e in export.entries:
        choice = entries.get(e.id)
        if choice is not None and choice.target in folding:
            m.fold(e, choice)
    for s in export.snippets:
        target = snippets.get(s.id, "note")
        if target == "skip":
            m.became(s.origin, s.title or "Snippet", "left_out", None)
        else:
            m.snippet(s, target)
    for c in export.chats:
        if chats:
            m.chat(c)
        else:
            m.became(c.origin, c.title or "Conversation", "left_out", None)
    record.raw = {
        "entries": {e.id: {**e.raw, "front_matter_fields": e.fields} for e in export.entries},
        "snippets": {s.id: {"title": s.title, "favourite": s.favourite, "date": s.date} for s in export.snippets},
    }
    db.flush()
