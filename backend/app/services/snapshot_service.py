"""Snapshot service: serialize, delta, restore, diff, retention, export, import."""

import copy
import io
import json
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import DateTime as SA_DateTime
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ..config import settings as app_settings
from ..models.activity_log import ActivityLog
from ..models.calendar import Calendar
from ..models.character import Character, CharacterRelationship
from ..models.character_journey import CharacterJourneySummary
from ..models.chat_message import ChatMessage
from ..models.chat_session import ChatSession
from ..models.compendium import CompendiumAttachment, CompendiumEntry
from ..models.culture import Culture
from ..models.diagram import Diagram
from ..models.dialogue import DialogueBlock
from ..models.discovered_element import DiscoveredElement
from ..models.historical_event import Era, HistoricalEvent
from ..models.interview import CharacterInterview
from ..models.location import Location, SceneSetting
from ..models.location_travel import LocationTravel
from ..models.media import AssetAttachment, StoryAsset
from ..models.note import StoryNote
from ..models.outline import Outline, OutlineItem
from ..models.panel_interview import PanelInterview
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.scene_link import SceneLink
from ..models.setting import Setting
from ..models.snapshot import StoryBackupSettings, StorySnapshot
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.todo import StoryTodo
from ..models.twist import Twist
from ..models.world_system import WorldSystem

FORMAT_VERSION = 1
APP_VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Disk helpers
# ---------------------------------------------------------------------------


def _get_snapshot_dir(story_id: str) -> Path:
    """Return (and create) the per-story snapshot directory on disk."""
    path = Path(app_settings.snapshots_path) / story_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _snapshot_file_path(story_id: str, snapshot_id: str) -> Path:
    return _get_snapshot_dir(story_id) / f"{snapshot_id}.lorestudio.zip"


def _write_snapshot_to_disk(snapshot: StorySnapshot, db: Session) -> None:
    """Generate and persist the zip archive for a snapshot."""
    zip_bytes = _build_zip_bytes(snapshot, db)
    _snapshot_file_path(snapshot.story_id, snapshot.id).write_bytes(zip_bytes)


def _delete_snapshot_from_disk(story_id: str, snapshot_id: str) -> None:
    """Remove the zip archive for a snapshot (silent if missing)."""
    path = _snapshot_file_path(story_id, snapshot_id)
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


# Entity keys that support added/removed/modified delta tracking
_DELTA_ENTITY_KEYS = [
    "structure_nodes",
    "characters",
    "character_relationships",
    "plot_threads",
    "plot_thread_appearances",
    "twists",
    "locations",
    "scene_settings",
    "world_systems",
    "cultures",
    "eras",
    "historical_events",
    "calendars",
    "compendium_entries",
    "outline_items",
    "settings",
    "notes",
    "diagrams",
    "interviews",
    "panel_interviews",
    "media_assets",
    "outlines",
    "scene_links",
    "todos",
    "reader_knowledge_events",
    "location_travel",
    "asset_attachments",
    "discovered_elements",
    "dialogue_blocks",
    "compendium_attachments",
    "character_journey_summaries",
]

#: Every table that carries a ``story_id`` column, mapped to the key it is
#: serialized under. ``tests/services/test_snapshot_completeness.py`` walks
#: ``Base.metadata`` and fails if a story-owned table is missing here, so a new
#: model cannot silently fall out of backups. Tables reached through another
#: parent (character_relationships via characters, dialogue_blocks via
#: structure_nodes, ...) are listed in ``SNAPSHOT_INDIRECT_TABLES``.
SNAPSHOT_KEYS_BY_TABLE: dict[str, str] = {
    "structure_nodes": "structure_nodes",
    "characters": "characters",
    "plot_threads": "plot_threads",
    "twists": "twists",
    "locations": "locations",
    "world_systems": "world_systems",
    "cultures": "cultures",
    "eras": "eras",
    "historical_events": "historical_events",
    "calendars": "calendars",
    "settings": "settings",
    "story_notes": "notes",
    "compendium_entries": "compendium_entries",
    "outlines": "outlines",
    "diagrams": "diagrams",
    "panel_interviews": "panel_interviews",
    "chat_sessions": "chat_sessions",
    "activity_logs": "activity_logs",
    "story_assets": "media_assets",
    "scene_links": "scene_links",
    "story_todos": "todos",
    "reader_knowledge_events": "reader_knowledge_events",
    "discovered_elements": "discovered_elements",
}

#: Story-owned tables that have no story_id column of their own.
SNAPSHOT_INDIRECT_TABLES: dict[str, str] = {
    "character_relationships": "character_relationships",
    "character_interviews": "interviews",
    "character_journey_summaries": "character_journey_summaries",
    "plot_thread_appearances": "plot_thread_appearances",
    "scene_settings": "scene_settings",
    "location_travel": "location_travel",
    "outline_items": "outline_items",
    "asset_attachments": "asset_attachments",
    "compendium_attachments": "compendium_attachments",
    "dialogue_blocks": "dialogue_blocks",
    "chat_messages": "chat_sessions",  # nested inside each session
}

#: Tables deliberately not part of a snapshot: the snapshot machinery itself, the undo
#: change log, and the AI call payloads — an audit trail with its own retention, kept out
#: because restoring a snapshot should not resurrect prompts the author had pruned.
SNAPSHOT_EXCLUDED_TABLES = {"stories", "story_snapshots", "story_backup_settings", "changes", "ai_call_payloads"}


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def _model_to_dict(obj) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict (attribute names as keys)."""
    result = {}
    for col_attr in sa_inspect(type(obj)).mapper.column_attrs:
        key = col_attr.key
        val = getattr(obj, key)
        if isinstance(val, datetime):
            val = val.isoformat()
        result[key] = val
    return result


def _dict_to_model(model_class, data: dict):
    """Create a model instance from a dict, converting ISO datetime strings back."""
    if model_class is StructureNode and isinstance(data.get("metadata_"), dict):
        # Snapshots taken before migration 0002 kept purpose/inline_notes inside metadata_.
        meta = dict(data["metadata_"])
        data = {**data, "metadata_": meta}
        for key in ("purpose", "inline_notes"):
            if key in meta and not data.get(key):
                data[key] = meta.pop(key)
            else:
                meta.pop(key, None)
    mapper = sa_inspect(model_class).mapper
    processed = {}
    col_types = {ca.key: ca.columns[0].type for ca in mapper.column_attrs}
    for key, val in data.items():
        if key not in col_types:
            continue
        if isinstance(col_types[key], SA_DateTime) and isinstance(val, str) and val:
            try:
                val = datetime.fromisoformat(val)
            except (ValueError, TypeError):
                pass
        processed[key] = val
    return model_class(**processed)


def _insert_ordered_tree(model_class, records: list[dict], db: Session) -> None:
    """Insert tree-structured records (with parent_id) in parent-first order."""
    by_id = {r["id"]: r for r in records}
    inserted: set[str] = set()

    def _insert(node_id: str) -> None:
        if node_id in inserted or node_id not in by_id:
            return
        node = by_id[node_id]
        parent_id = node.get("parent_id")
        if parent_id and parent_id not in inserted:
            _insert(parent_id)
        db.add(_dict_to_model(model_class, node))
        inserted.add(node_id)

    for node_id in list(by_id):
        _insert(node_id)
    db.flush()


# ---------------------------------------------------------------------------
# Settings helpers
# ---------------------------------------------------------------------------


def _get_or_create_settings(story_id: str, db: Session) -> StoryBackupSettings:
    settings = db.query(StoryBackupSettings).filter(StoryBackupSettings.story_id == story_id).first()
    if not settings:
        settings = StoryBackupSettings(story_id=story_id)
        db.add(settings)
        db.flush()
    return settings


def _find_anchor_snapshot(story_id: str, db: Session) -> "StorySnapshot | None":
    """Find the most recent manual snapshot to use as the delta base for auto backups."""
    return (
        db.query(StorySnapshot)
        .filter(
            StorySnapshot.story_id == story_id,
            StorySnapshot.trigger == "manual",
            StorySnapshot.snapshot_type == "full",
        )
        .order_by(StorySnapshot.created_at.desc())
        .first()
    )


def _delta_is_empty(delta: dict) -> bool:
    """Return True if the delta contains no meaningful changes."""
    if delta.get("story"):
        return False
    for key in _DELTA_ENTITY_KEYS:
        v = delta.get(key, {})
        if v.get("added") or v.get("removed") or v.get("modified"):
            return False
    cs = delta.get("chat_sessions", {})
    if cs.get("added") or cs.get("removed") or cs.get("modified"):
        return False
    if delta.get("activity_logs", {}).get("added"):
        return False
    return True


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def serialize_story(story_id: str, db: Session, settings: StoryBackupSettings | None = None) -> dict:  # noqa: PLR0915
    """Serialize the full story state to a plain dict."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise ValueError(f"Story {story_id} not found")

    data: dict[str, Any] = {}
    data["story"] = _model_to_dict(story)

    # Structure nodes (flat)
    data["structure_nodes"] = [
        _model_to_dict(n) for n in db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    ]

    # Characters + relationships
    char_ids = [row[0] for row in db.query(Character.id).filter(Character.story_id == story_id).all()]
    char_id_set = set(char_ids)
    data["characters"] = [_model_to_dict(c) for c in db.query(Character).filter(Character.story_id == story_id).all()]
    data["character_relationships"] = (
        [
            _model_to_dict(r)
            for r in db.query(CharacterRelationship).filter(CharacterRelationship.character_id.in_(char_id_set)).all()
        ]
        if char_id_set
        else []
    )

    # Plot threads + appearances
    thread_ids = [row[0] for row in db.query(PlotThread.id).filter(PlotThread.story_id == story_id).all()]
    thread_id_set = set(thread_ids)
    data["plot_threads"] = [
        _model_to_dict(t) for t in db.query(PlotThread).filter(PlotThread.story_id == story_id).all()
    ]
    data["plot_thread_appearances"] = (
        [
            _model_to_dict(a)
            for a in db.query(PlotThreadAppearance).filter(PlotThreadAppearance.thread_id.in_(thread_id_set)).all()
        ]
        if thread_id_set
        else []
    )

    # Twists (clues embedded in JSON)
    data["twists"] = [_model_to_dict(t) for t in db.query(Twist).filter(Twist.story_id == story_id).all()]

    # Locations + scene_settings
    loc_ids = [row[0] for row in db.query(Location.id).filter(Location.story_id == story_id).all()]
    loc_id_set = set(loc_ids)
    data["locations"] = [_model_to_dict(loc) for loc in db.query(Location).filter(Location.story_id == story_id).all()]
    data["scene_settings"] = (
        [_model_to_dict(s) for s in db.query(SceneSetting).filter(SceneSetting.location_id.in_(loc_id_set)).all()]
        if loc_id_set
        else []
    )

    # World building
    data["world_systems"] = [
        _model_to_dict(w) for w in db.query(WorldSystem).filter(WorldSystem.story_id == story_id).all()
    ]
    data["cultures"] = [_model_to_dict(c) for c in db.query(Culture).filter(Culture.story_id == story_id).all()]
    data["eras"] = [_model_to_dict(e) for e in db.query(Era).filter(Era.story_id == story_id).all()]
    data["historical_events"] = [
        _model_to_dict(h) for h in db.query(HistoricalEvent).filter(HistoricalEvent.story_id == story_id).all()
    ]
    data["calendars"] = [_model_to_dict(c) for c in db.query(Calendar).filter(Calendar.story_id == story_id).all()]

    # Settings (old-style named settings, distinct from StoryBackupSettings)
    data["settings"] = [_model_to_dict(s) for s in db.query(Setting).filter(Setting.story_id == story_id).all()]

    # Notes
    data["notes"] = [_model_to_dict(n) for n in db.query(StoryNote).filter(StoryNote.story_id == story_id).all()]

    # Compendium (metadata only — no binary assets inline)
    data["compendium_entries"] = [
        _model_to_dict(e) for e in db.query(CompendiumEntry).filter(CompendiumEntry.story_id == story_id).all()
    ]

    # Outlines + items
    story_outlines = db.query(Outline).filter(Outline.story_id == story_id).all()
    outline_ids = [o.id for o in story_outlines]
    data["outlines"] = [_model_to_dict(o) for o in story_outlines]
    data["outline_items"] = (
        [_model_to_dict(i) for i in db.query(OutlineItem).filter(OutlineItem.outline_id.in_(outline_ids)).all()]
        if outline_ids
        else []
    )

    node_ids = [n["id"] for n in data["structure_nodes"]]
    node_id_set = set(node_ids)

    data["scene_links"] = [
        _model_to_dict(link) for link in db.query(SceneLink).filter(SceneLink.story_id == story_id).all()
    ]
    data["todos"] = [_model_to_dict(t) for t in db.query(StoryTodo).filter(StoryTodo.story_id == story_id).all()]
    data["reader_knowledge_events"] = [
        _model_to_dict(e)
        for e in db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id).all()
    ]
    data["discovered_elements"] = [
        _model_to_dict(e) for e in db.query(DiscoveredElement).filter(DiscoveredElement.story_id == story_id).all()
    ]
    data["location_travel"] = (
        [
            _model_to_dict(t)
            for t in db.query(LocationTravel).filter(LocationTravel.from_location_id.in_(loc_id_set)).all()
        ]
        if loc_id_set
        else []
    )
    data["dialogue_blocks"] = (
        [_model_to_dict(b) for b in db.query(DialogueBlock).filter(DialogueBlock.scene_id.in_(node_id_set)).all()]
        if node_id_set
        else []
    )
    data["character_journey_summaries"] = (
        [
            _model_to_dict(j)
            for j in db.query(CharacterJourneySummary)
            .filter(CharacterJourneySummary.character_id.in_(char_id_set))
            .all()
        ]
        if char_id_set
        else []
    )
    entry_ids = [e["id"] for e in data["compendium_entries"]]
    data["compendium_attachments"] = (
        [
            _model_to_dict(a)
            for a in db.query(CompendiumAttachment).filter(CompendiumAttachment.entry_id.in_(entry_ids)).all()
        ]
        if entry_ids
        else []
    )

    # Optional configurable content
    if settings is None or settings.include_diagrams:
        data["diagrams"] = [_model_to_dict(d) for d in db.query(Diagram).filter(Diagram.story_id == story_id).all()]

    if settings is None or settings.include_interviews:
        data["interviews"] = (
            [
                _model_to_dict(i)
                for i in db.query(CharacterInterview).filter(CharacterInterview.character_id.in_(char_id_set)).all()
            ]
            if char_id_set
            else []
        )
        data["panel_interviews"] = [
            _model_to_dict(p) for p in db.query(PanelInterview).filter(PanelInterview.story_id == story_id).all()
        ]

    if settings is None or settings.include_chat_sessions:
        sessions = db.query(ChatSession).filter(ChatSession.story_id == story_id).all()
        session_data = []
        for s in sessions:
            s_dict = _model_to_dict(s)
            s_dict["messages"] = [
                _model_to_dict(m)
                for m in db.query(ChatMessage)
                .filter(ChatMessage.session_id == s.id)
                .order_by(ChatMessage.created_at)
                .all()
            ]
            session_data.append(s_dict)
        data["chat_sessions"] = session_data

    if settings is None or settings.include_activity_logs:
        q = db.query(ActivityLog).filter(ActivityLog.story_id == story_id).order_by(ActivityLog.created_at.desc())
        limit = settings.activity_log_limit if settings else 500
        if limit:
            q = q.limit(limit)
        data["activity_logs"] = [_model_to_dict(log) for log in q.all()]

    if settings is None or settings.include_media_assets:
        data["media_assets"] = [
            _model_to_dict(a) for a in db.query(StoryAsset).filter(StoryAsset.story_id == story_id).all()
        ]
        asset_ids = [a["id"] for a in data["media_assets"]]
        data["asset_attachments"] = (
            [_model_to_dict(a) for a in db.query(AssetAttachment).filter(AssetAttachment.asset_id.in_(asset_ids)).all()]
            if asset_ids
            else []
        )

    return data


def _compute_summary(data: dict) -> dict:
    total_wc = sum(n.get("word_count", 0) or 0 for n in data.get("structure_nodes", []))
    return {
        "word_count": total_wc,
        "scene_count": len(data.get("structure_nodes", [])),
        "character_count": len(data.get("characters", [])),
        "thread_count": len(data.get("plot_threads", [])),
    }


# ---------------------------------------------------------------------------
# Delta computation
# ---------------------------------------------------------------------------


def compute_delta(current_data: dict, base_data: dict) -> tuple[dict, dict]:
    """
    Compute the delta between current state and base state.
    Returns (delta_data, delta_summary).
    """
    delta: dict[str, Any] = {}

    # Story metadata changes
    cur_story = current_data.get("story", {})
    base_story = base_data.get("story", {})
    story_changes = {k: v for k, v in cur_story.items() if base_story.get(k) != v}
    if story_changes:
        delta["story"] = story_changes

    # Entity collections
    for key in _DELTA_ENTITY_KEYS:
        cur_list = current_data.get(key, [])
        base_list = base_data.get(key, [])
        base_by_id = {item["id"]: item for item in base_list}
        cur_by_id = {item["id"]: item for item in cur_list}

        added = [item for item in cur_list if item["id"] not in base_by_id]
        removed_ids = [id_ for id_ in base_by_id if id_ not in cur_by_id]
        modified = [item for item in cur_list if item["id"] in base_by_id and item != base_by_id[item["id"]]]

        if added or removed_ids or modified:
            delta[key] = {"added": added, "removed": removed_ids, "modified": modified}

    # Chat sessions (nested messages)
    cur_sessions = {s["id"]: s for s in current_data.get("chat_sessions", [])}
    base_sessions = {s["id"]: s for s in base_data.get("chat_sessions", [])}
    s_added = [s for sid, s in cur_sessions.items() if sid not in base_sessions]
    s_removed = [sid for sid in base_sessions if sid not in cur_sessions]
    s_modified = [s for sid, s in cur_sessions.items() if sid in base_sessions and s != base_sessions[sid]]
    if s_added or s_removed or s_modified:
        delta["chat_sessions"] = {"added": s_added, "removed": s_removed, "modified": s_modified}

    # Activity logs (append-only — only track new entries)
    base_log_ids = {log["id"] for log in base_data.get("activity_logs", [])}
    new_logs = [log for log in current_data.get("activity_logs", []) if log["id"] not in base_log_ids]
    if new_logs:
        delta["activity_logs"] = {"added": new_logs}

    # Delta summary
    cur_summary = _compute_summary(current_data)
    base_summary = _compute_summary(base_data)
    delta_summary = {
        "word_count_delta": cur_summary["word_count"] - base_summary["word_count"],
        "scenes_added": len(delta.get("structure_nodes", {}).get("added", [])),
        "scenes_removed": len(delta.get("structure_nodes", {}).get("removed", [])),
        "scenes_modified": len(delta.get("structure_nodes", {}).get("modified", [])),
        "characters_added": len(delta.get("characters", {}).get("added", [])),
        "characters_modified": len(delta.get("characters", {}).get("modified", [])),
        "threads_added": len(delta.get("plot_threads", {}).get("added", [])),
        "threads_modified": len(delta.get("plot_threads", {}).get("modified", [])),
    }

    return delta, delta_summary


def apply_delta(base_data: dict, delta_data: dict) -> dict:
    """Reconstruct full state from base data + delta."""
    result = copy.deepcopy(base_data)

    # Story metadata
    if "story" in delta_data:
        result.setdefault("story", {}).update(delta_data["story"])

    # Entity collections
    for key in _DELTA_ENTITY_KEYS:
        if key not in delta_data:
            continue
        changes = delta_data[key]
        by_id = {item["id"]: item for item in result.get(key, [])}
        for rid in changes.get("removed", []):
            by_id.pop(rid, None)
        for item in changes.get("modified", []):
            by_id[item["id"]] = item
        for item in changes.get("added", []):
            by_id[item["id"]] = item
        result[key] = list(by_id.values())

    # Chat sessions
    if "chat_sessions" in delta_data:
        changes = delta_data["chat_sessions"]
        by_id = {s["id"]: s for s in result.get("chat_sessions", [])}
        for sid in changes.get("removed", []):
            by_id.pop(sid, None)
        for s in changes.get("modified", []):
            by_id[s["id"]] = s
        for s in changes.get("added", []):
            by_id[s["id"]] = s
        result["chat_sessions"] = list(by_id.values())

    # Activity logs (append only)
    if "activity_logs" in delta_data:
        existing_ids = {log["id"] for log in result.get("activity_logs", [])}
        for log in delta_data["activity_logs"].get("added", []):
            if log["id"] not in existing_ids:
                result.setdefault("activity_logs", []).append(log)

    return result


def resolve_snapshot_data(snapshot: StorySnapshot, db: Session) -> dict:
    """Get the full state dict for a snapshot (handles delta chain resolution)."""
    if snapshot.snapshot_type == "full":
        return snapshot.data
    base = db.get(StorySnapshot, snapshot.base_snapshot_id)
    if not base:
        raise ValueError(f"Base snapshot {snapshot.base_snapshot_id} not found")
    base_data = resolve_snapshot_data(base, db)
    return apply_delta(base_data, snapshot.data)


# ---------------------------------------------------------------------------
# Diff
# ---------------------------------------------------------------------------


def diff_snapshots(snap_a: StorySnapshot, snap_b: StorySnapshot, db: Session) -> dict:
    """
    Compare two snapshots structurally. a = older, b = newer.
    Returns entity-level added/removed/modified counts.
    """
    data_a = resolve_snapshot_data(snap_a, db)
    data_b = resolve_snapshot_data(snap_b, db)

    def _diff_entities(key: str) -> dict | None:
        map_a = {item["id"]: item for item in data_a.get(key, [])}
        map_b = {item["id"]: item for item in data_b.get(key, [])}
        added = [map_b[id_] for id_ in map_b if id_ not in map_a]
        removed = [map_a[id_] for id_ in map_a if id_ not in map_b]
        modified = [map_b[id_] for id_ in map_b if id_ in map_a and map_b[id_] != map_a[id_]]
        if not (added or removed or modified):
            return None
        return {"added": added, "removed": removed, "modified": modified}

    summary_a = _compute_summary(data_a)
    summary_b = _compute_summary(data_b)
    diff: dict[str, Any] = {
        "word_count_delta": summary_b["word_count"] - summary_a["word_count"],
        "summary": {"a": summary_a, "b": summary_b},
    }

    for key in [
        "structure_nodes",
        "characters",
        "plot_threads",
        "twists",
        "locations",
        "world_systems",
        "cultures",
        "eras",
        "outline_items",
    ]:
        result = _diff_entities(key)
        if result:
            diff[key] = result

    return diff


# ---------------------------------------------------------------------------
# Retention
# ---------------------------------------------------------------------------


def apply_retention(story_id: str, db: Session, settings: StoryBackupSettings) -> None:
    """Prune old unnamed auto-backups based on retention settings."""
    if not settings.max_count and not settings.max_age_days:
        return

    candidates = (
        db.query(StorySnapshot)
        .filter(
            StorySnapshot.story_id == story_id,
            StorySnapshot.name.is_(None),
            StorySnapshot.trigger == "auto",
        )
        .order_by(StorySnapshot.created_at.asc())
        .all()
    )

    to_delete: set[str] = set()

    if settings.max_age_days:
        cutoff = datetime.now(UTC) - timedelta(days=settings.max_age_days)
        for snap in candidates:
            created = snap.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=UTC)
            if created < cutoff:
                to_delete.add(snap.id)

    if settings.max_count:
        total = db.query(StorySnapshot).filter(StorySnapshot.story_id == story_id).count()
        excess = total - settings.max_count
        for snap in candidates:
            if excess <= 0:
                break
            if snap.id not in to_delete:
                to_delete.add(snap.id)
                excess -= 1

    for snap_id in to_delete:
        snap = db.get(StorySnapshot, snap_id)
        if snap:
            db.delete(snap)
            _delete_snapshot_from_disk(story_id, snap_id)


# ---------------------------------------------------------------------------
# Create snapshot
# ---------------------------------------------------------------------------


def create_snapshot(
    story_id: str,
    db: Session,
    trigger: str = "manual",
    name: str | None = None,
    settings: StoryBackupSettings | None = None,
    force: bool = False,
) -> "StorySnapshot | None":
    """Create a snapshot.

    Manual snapshots are always full and never skipped.
    Auto backups delta off the most recent manual snapshot (anchor).
    If nothing has changed since the anchor and force=False, returns None.
    Pass force=True for safety backups (pre-restore, pre-import) to always create.
    """
    if settings is None:
        settings = _get_or_create_settings(story_id, db)

    current_data = serialize_story(story_id, db, settings)
    summary = _compute_summary(current_data)

    if trigger == "manual":
        snapshot = StorySnapshot(
            story_id=story_id,
            name=name,
            trigger=trigger,
            snapshot_type="full",
            data=current_data,
            summary=summary,
        )
    else:
        # Auto backup: delta off the anchor (most recent manual snapshot)
        anchor = _find_anchor_snapshot(story_id, db)
        if not anchor:
            # No manual snapshot yet — store as full (becomes the implicit base)
            snapshot = StorySnapshot(
                story_id=story_id,
                name=name,
                trigger=trigger,
                snapshot_type="full",
                data=current_data,
                summary=summary,
            )
        else:
            anchor_data = resolve_snapshot_data(anchor, db)
            delta_data, delta_summary = compute_delta(current_data, anchor_data)
            if not force and _delta_is_empty(delta_data):
                return None  # Nothing changed since the last snapshot — skip
            snapshot = StorySnapshot(
                story_id=story_id,
                name=name,
                trigger=trigger,
                snapshot_type="delta",
                base_snapshot_id=anchor.id,
                data=delta_data,
                summary=summary,
                delta_summary=delta_summary,
            )

    db.add(snapshot)
    db.flush()

    if trigger == "auto":
        settings.last_auto_backup_at = datetime.now(UTC)
        db.flush()

    apply_retention(story_id, db, settings)
    db.commit()
    db.refresh(snapshot)

    try:
        _write_snapshot_to_disk(snapshot, db)
    except OSError:
        pass  # Disk write failure is non-fatal; archive can be rebuilt on export

    return snapshot


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------


def restore_snapshot(
    snapshot: StorySnapshot,
    db: Session,
    create_safety_backup: bool = True,
) -> Story:
    """Restore a story to the state captured in a snapshot."""
    story_id = snapshot.story_id

    if create_safety_backup:
        settings = _get_or_create_settings(story_id, db)
        create_snapshot(story_id, db, trigger="auto", name="Pre-restore backup", settings=settings, force=True)

    state = resolve_snapshot_data(snapshot, db)
    _delete_story_content(story_id, db, state)
    _insert_story_content(state, db)
    db.commit()
    story = db.get(Story, story_id)
    assert story is not None
    return story


def _delete_story_content(story_id: str, db: Session, state: dict | None = None) -> None:
    """Delete story content in FK-safe order (preserves the Story row itself).

    Optional sections (diagrams, interviews, chat sessions, activity logs, media)
    are only cleared when ``state`` contains them, so restoring a snapshot that
    was taken without, say, media assets does not wipe the current ones.
    """

    def _has(key: str) -> bool:
        return state is None or key in state

    char_ids = [row[0] for row in db.query(Character.id).filter(Character.story_id == story_id).all()]
    node_ids = [row[0] for row in db.query(StructureNode.id).filter(StructureNode.story_id == story_id).all()]
    loc_ids = [row[0] for row in db.query(Location.id).filter(Location.story_id == story_id).all()]
    thread_ids = [row[0] for row in db.query(PlotThread.id).filter(PlotThread.story_id == story_id).all()]
    outline_ids = [row[0] for row in db.query(Outline.id).filter(Outline.story_id == story_id).all()]
    entry_ids = [row[0] for row in db.query(CompendiumEntry.id).filter(CompendiumEntry.story_id == story_id).all()]

    def _bulk_delete(model, column, ids) -> None:
        if ids:
            db.query(model).filter(column.in_(ids)).delete(synchronize_session=False)

    def _delete_by_story(model) -> None:
        db.query(model).filter(model.story_id == story_id).delete(synchronize_session=False)

    # Break the Story -> pov_character reference before characters go away.
    story_row = db.get(Story, story_id)
    if story_row is not None:
        story_row.pov_character_id = None
        db.flush()

    # Leaves first: rows that reference characters, nodes, locations, threads.
    _bulk_delete(CharacterRelationship, CharacterRelationship.character_id, char_ids)
    _bulk_delete(CharacterJourneySummary, CharacterJourneySummary.character_id, char_ids)
    _bulk_delete(DialogueBlock, DialogueBlock.scene_id, node_ids)
    _bulk_delete(PlotThreadAppearance, PlotThreadAppearance.thread_id, thread_ids)
    _bulk_delete(SceneSetting, SceneSetting.location_id, loc_ids)
    _bulk_delete(LocationTravel, LocationTravel.from_location_id, loc_ids)
    _bulk_delete(OutlineItem, OutlineItem.outline_id, outline_ids)
    _bulk_delete(CompendiumAttachment, CompendiumAttachment.entry_id, entry_ids)
    _delete_by_story(SceneLink)
    _delete_by_story(StoryTodo)
    _delete_by_story(ReaderKnowledgeEvent)
    _delete_by_story(DiscoveredElement)

    if _has("interviews"):
        _bulk_delete(CharacterInterview, CharacterInterview.character_id, char_ids)
    if _has("panel_interviews"):
        _delete_by_story(PanelInterview)
    if _has("chat_sessions"):
        session_ids = [row[0] for row in db.query(ChatSession.id).filter(ChatSession.story_id == story_id).all()]
        _bulk_delete(ChatMessage, ChatMessage.session_id, session_ids)
        _delete_by_story(ChatSession)
    if _has("activity_logs"):
        _delete_by_story(ActivityLog)
    if _has("diagrams"):
        _delete_by_story(Diagram)

    # Twists reference nodes; nodes reference characters; compendium entries reference assets.
    _delete_by_story(Twist)
    _delete_by_story(StructureNode)
    _delete_by_story(Character)
    _delete_by_story(PlotThread)
    _delete_by_story(Location)
    _delete_by_story(WorldSystem)
    _delete_by_story(Culture)
    _delete_by_story(HistoricalEvent)
    _delete_by_story(Era)
    _delete_by_story(Calendar)
    _delete_by_story(CompendiumEntry)
    _delete_by_story(Outline)
    _delete_by_story(Setting)
    _delete_by_story(StoryNote)

    if _has("media_assets"):
        asset_ids = [row[0] for row in db.query(StoryAsset.id).filter(StoryAsset.story_id == story_id).all()]
        _bulk_delete(AssetAttachment, AssetAttachment.asset_id, asset_ids)
        _delete_by_story(StoryAsset)
    db.flush()


def _insert_story_content(state: dict, db: Session) -> None:  # noqa: PLR0915
    """Re-insert story content from a serialized state dict."""
    # Update story metadata (keep the story row — just update fields)
    story_dict = state.get("story", {})
    story = db.get(Story, story_dict.get("id"))
    if story:
        for k, v in story_dict.items():
            if k in ("id", "user_id", "created_at", "pov_character_id"):
                continue  # pov_character_id is applied after characters are re-inserted
            if isinstance(v, str) and hasattr(Story, k):
                col_type = (
                    sa_inspect(Story).mapper.column_attrs[k].columns[0].type
                    if k in {ca.key for ca in sa_inspect(Story).mapper.column_attrs}
                    else None
                )
                if col_type and isinstance(col_type, SA_DateTime):
                    try:
                        v = datetime.fromisoformat(v)
                    except (ValueError, TypeError):
                        pass
            setattr(story, k, v)

    # Tree structures: insert parent-first
    # Characters first: structure nodes and the story row may point at a POV character.
    def _insert_all(model_class, records: list[dict]) -> None:
        for rec in records:
            db.add(_dict_to_model(model_class, rec))
        if records:
            db.flush()

    _insert_all(Character, state.get("characters", []))
    if story and story_dict.get("pov_character_id"):
        story.pov_character_id = story_dict["pov_character_id"]
        db.flush()
    _insert_ordered_tree(StructureNode, state.get("structure_nodes", []), db)
    _insert_ordered_tree(Location, state.get("locations", []), db)
    _insert_all(Outline, state.get("outlines", []))
    _insert_ordered_tree(OutlineItem, state.get("outline_items", []), db)

    # Flat entities
    _insert_all(CharacterRelationship, state.get("character_relationships", []))
    _insert_all(PlotThread, state.get("plot_threads", []))
    _insert_all(PlotThreadAppearance, state.get("plot_thread_appearances", []))
    _insert_all(Twist, state.get("twists", []))
    _insert_all(SceneSetting, state.get("scene_settings", []))
    _insert_all(WorldSystem, state.get("world_systems", []))
    _insert_all(Culture, state.get("cultures", []))
    _insert_all(Era, state.get("eras", []))
    _insert_all(HistoricalEvent, state.get("historical_events", []))
    _insert_all(Calendar, state.get("calendars", []))
    if "media_assets" in state:  # compendium entries may reference assets
        _insert_all(StoryAsset, state.get("media_assets", []))
        _insert_all(AssetAttachment, state.get("asset_attachments", []))
    _insert_all(CompendiumEntry, state.get("compendium_entries", []))
    _insert_all(Setting, state.get("settings", []))
    _insert_all(StoryNote, state.get("notes", []))
    _insert_all(Diagram, state.get("diagrams", []))
    _insert_all(CharacterInterview, state.get("interviews", []))
    _insert_all(PanelInterview, state.get("panel_interviews", []))
    _insert_all(ActivityLog, state.get("activity_logs", []))
    _insert_all(SceneLink, state.get("scene_links", []))
    _insert_all(StoryTodo, state.get("todos", []))
    _insert_all(ReaderKnowledgeEvent, state.get("reader_knowledge_events", []))
    _insert_all(DiscoveredElement, state.get("discovered_elements", []))
    _insert_all(LocationTravel, state.get("location_travel", []))
    _insert_all(DialogueBlock, state.get("dialogue_blocks", []))
    _insert_all(CharacterJourneySummary, state.get("character_journey_summaries", []))
    _insert_all(CompendiumAttachment, state.get("compendium_attachments", []))

    # Chat sessions with nested messages
    for session_data in state.get("chat_sessions", []):
        session_copy = {k: v for k, v in session_data.items() if k != "messages"}
        messages = session_data.get("messages", [])
        db.add(_dict_to_model(ChatSession, session_copy))
        db.flush()
        for msg in messages:
            db.add(_dict_to_model(ChatMessage, msg))
        if messages:
            db.flush()


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------


def _build_zip_bytes(snapshot: StorySnapshot, db: Session) -> bytes:
    """Build the raw zip archive bytes for a snapshot (always recomputes)."""
    state = resolve_snapshot_data(snapshot, db)
    story_meta = state.get("story", {})

    manifest = {
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "app_version": APP_VERSION,
        "snapshot_id": snapshot.id,
        "story_id": snapshot.story_id,
        "story_title": story_meta.get("title", ""),
        "snapshot_name": snapshot.name,
        "snapshot_created_at": snapshot.created_at.isoformat(),
        "includes": {
            "diagrams": "diagrams" in state,
            "interviews": "interviews" in state or "panel_interviews" in state,
            "chat_sessions": "chat_sessions" in state,
            "activity_logs": "activity_logs" in state,
            "media_assets": "media_assets" in state,
        },
        "stats": snapshot.summary or {},
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))
        zf.writestr("story.json", json.dumps(state, indent=2, default=str))

    return buf.getvalue()


def export_snapshot(snapshot: StorySnapshot, db: Session) -> bytes:
    """Return the .lorestudio.zip bytes for the given snapshot.

    Reads from disk if the archive already exists; otherwise computes and
    persists it so subsequent downloads are instant.
    """
    disk_path = _snapshot_file_path(snapshot.story_id, snapshot.id)
    if disk_path.exists():
        return disk_path.read_bytes()

    zip_bytes = _build_zip_bytes(snapshot, db)
    disk_path.parent.mkdir(parents=True, exist_ok=True)
    disk_path.write_bytes(zip_bytes)
    return zip_bytes


def import_snapshot_file(file_bytes: bytes) -> dict:
    """
    Parse an uploaded .lorestudio.zip file.
    Returns {"manifest": {...}, "state": {...}}.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            manifest = json.loads(zf.read("manifest.json"))
            state = json.loads(zf.read("story.json"))
    except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid .lorestudio.zip file: {exc}")

    if manifest.get("format_version") != FORMAT_VERSION:
        raise ValueError(f"Unsupported format version: {manifest.get('format_version')}")

    return {"manifest": manifest, "state": state}


# ---------------------------------------------------------------------------
# Backup status
# ---------------------------------------------------------------------------


def get_backup_status(story_id: str, db: Session) -> dict:
    """Return backup status info for the header indicator."""
    settings = db.query(StoryBackupSettings).filter(StoryBackupSettings.story_id == story_id).first()
    last_snap = (
        db.query(StorySnapshot)
        .filter(StorySnapshot.story_id == story_id)
        .order_by(StorySnapshot.created_at.desc())
        .first()
    )

    auto_enabled = settings.auto_enabled if settings else True
    interval_minutes = settings.interval_minutes if settings else 30

    if not last_snap:
        return {
            "last_backup_at": None,
            "last_backup_trigger": None,
            "auto_enabled": auto_enabled,
            "interval_minutes": interval_minutes,
            "staleness": "overdue",
            "next_auto_at": None,
        }

    last_at = last_snap.created_at
    if last_at.tzinfo is None:
        last_at = last_at.replace(tzinfo=UTC)

    now = datetime.now(UTC)
    elapsed_minutes = (now - last_at).total_seconds() / 60

    if elapsed_minutes <= interval_minutes:
        staleness = "fresh"
    elif elapsed_minutes <= interval_minutes * 2:
        staleness = "stale"
    else:
        staleness = "overdue"

    next_auto_at = None
    if auto_enabled:
        next_auto_at = (last_at + timedelta(minutes=interval_minutes)).isoformat()

    return {
        "last_backup_at": last_at.isoformat(),
        "last_backup_trigger": last_snap.trigger,
        "auto_enabled": auto_enabled,
        "interval_minutes": interval_minutes,
        "staleness": staleness,
        "next_auto_at": next_auto_at,
    }
