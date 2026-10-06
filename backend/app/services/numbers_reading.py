"""
The numbers over time (doc 19): a reading is the Numbers page's figures at one moment.

`measure` is pure: it reads a state dict in the shape a snapshot stores (``serialize_story``'s
keys), so the story as it is now and any earlier snapshot are measured by the same code and
cannot disagree. `reading_state` loads only the tables a reading needs, not the whole story.

Each part of a reading matches the live part it is compared with:

- ``words`` and ``summaries`` as ``services/numbers.py`` counts them (the tree's leaves, less
  empty containers for words);
- ``scenes`` as the page's charts lay them out (``sceneLeaves`` in the frontend: leaves at the
  template's deepest level, or with words), each with who is on its page by the `/scene-cast`
  rule (``services/scene_cast.py``) and the threads it carries;
- ``dialogue`` by the same shares function the page uses;
- ``prose`` copied from the run (restoring a snapshot replaces the activity log it lives in).
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from statistics import median
from types import SimpleNamespace
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.beat_sheet import BeatSheet
from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.location import ScenePresence
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.story import Story
from ..models.structure import StoryStructureTemplate, StructureNode
from .dialogue_service import sync_story_dialogue
from .findings import collect
from .findings.runs import RUN_EVENTS, latest_runs
from .numbers import CONTAINERS, STATUSES, form_for, prose_from_run, spoken_shares
from .scene_cast import cast_patterns, on_the_page
from .snapshot_service import _model_to_dict
from .structure_scaffold import FLAT
from .word_count import get_word_count_status

#: The shape of a reading's ``data``. Raise it when the shape changes, and read older ones by it.
READING_VERSION = 1

#: The tables a reading reads, by their snapshot keys.
STATE_KEYS = (
    "story",
    "structure_nodes",
    "characters",
    "plot_threads",
    "plot_thread_appearances",
    "scene_presence",
    "dialogue_blocks",
)


class _Row(SimpleNamespace):
    """A snapshot row read as an object. A field the snapshot predates reads as None, so an
    old version is measured with what it has rather than failing on what it lacks."""

    def __getattr__(self, name: str) -> Any:
        return None


def _rows(items: Iterable[dict]) -> list[SimpleNamespace]:
    """Snapshot rows as objects, so the helpers shared with the live page can read them."""
    return [_Row(**d) for d in items]


def reading_state(story_id: str, db: Session) -> dict[str, Any]:
    """The tables a reading needs, now, keyed as a snapshot keys them."""
    sync_story_dialogue(story_id, db)
    story = db.get(Story, story_id)
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    node_ids = [n.id for n in nodes]
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()
    thread_ids = [t.id for t in threads]
    return {
        "story": _model_to_dict(story),
        "structure_nodes": [_model_to_dict(n) for n in nodes],
        "characters": [_model_to_dict(c) for c in db.query(Character).filter(Character.story_id == story_id).all()],
        "plot_threads": [_model_to_dict(t) for t in threads],
        "plot_thread_appearances": [
            _model_to_dict(a)
            for a in db.query(PlotThreadAppearance).filter(PlotThreadAppearance.thread_id.in_(thread_ids)).all()
        ]
        if thread_ids
        else [],
        "scene_presence": [
            _model_to_dict(p) for p in db.query(ScenePresence).filter(ScenePresence.node_id.in_(node_ids)).all()
        ]
        if node_ids
        else [],
        "dialogue_blocks": [
            _model_to_dict(b)
            for b in db.query(DialogueBlock)
            .filter(
                DialogueBlock.scene_id.in_(node_ids),
                or_(DialogueBlock.dialogue_type.is_(None), DialogueBlock.dialogue_type != "thought"),
            )
            .all()
        ]
        if node_ids
        else [],
    }


def deepest_level(template_id: str | None, db: Session) -> int:
    """The level scenes live at, as the frontend's ``sceneLeaves`` reads the template."""
    if not template_id or template_id in FLAT:
        return 0
    template = db.get(StoryStructureTemplate, template_id)
    return max(0, len(template.levels) - 1) if template else 0


def beats_for(beat_sheet_id: str | None, db: Session) -> list[dict[str, Any]]:
    """The beat sheet's beats, where it places each (0 to 1). Sheets are shared, not the story's."""
    sheet = db.get(BeatSheet, beat_sheet_id) if beat_sheet_id else None
    return [
        {"id": b["id"], "name": b.get("name", ""), "at": min(1.0, max(0.0, (b.get("position_pct") or 0) / 100))}
        for b in (sheet.beats if sheet else [])
    ]


def _ordered(
    nodes: list[SimpleNamespace],
) -> tuple[list[SimpleNamespace], dict[str | None, list[SimpleNamespace]]]:
    """Every node depth first in reading order, and each node's children."""
    children: dict[str | None, list[SimpleNamespace]] = {}
    for n in nodes:
        children.setdefault(n.parent_id, []).append(n)
    for kids in children.values():
        kids.sort(key=lambda n: n.position or 0)
    out: list[SimpleNamespace] = []

    def walk(parent: str | None) -> None:
        for n in children.get(parent, []):
            out.append(n)
            walk(n.id)

    walk(None)
    return out, children


def _words(leaves: list[SimpleNamespace], form: str) -> dict[str, Any]:
    """``services/numbers.words`` over the same leaves: an empty chapter is a leaf, not a scene."""
    scenes = [n for n in leaves if (n.level_type or "").lower() not in CONTAINERS]
    by_status = dict.fromkeys(STATUSES, 0)
    for n in scenes:
        by_status[n.status or "draft"] = by_status.get(n.status or "draft", 0) + (n.word_count or 0)
    written = [n.word_count or 0 for n in scenes if (n.word_count or 0) > 0]
    total = sum(n.word_count or 0 for n in scenes)
    target = get_word_count_status(form, total)
    past = target is not None and target["warning_level"] == "exceeded"
    return {
        "total": total,
        "by_status": by_status,
        "scenes": len(scenes),
        "written_scenes": len(written),
        "mean_per_scene": round(sum(written) / len(written)) if written else 0,
        "median_per_scene": round(median(written)) if written else 0,
        "form": form,
        "target": target,
        "reads_as": form_for(total) if past else None,
    }


def _thread_status(thread: Any, roles: dict[str, list[str]]) -> str:
    """``PlotThread.status`` over a snapshot's rows: a thread's status is not stored, it follows
    from its scenes (doc 18): set aside, resolved once a scene closes it, open, or planned."""
    if thread.set_aside:
        return "set_aside"
    mine = roles.get(thread.id, [])
    if "closes" in mine:
        return "resolved"
    return "open" if mine else "planned"


def measure(
    state: dict[str, Any],
    *,
    deepest: int,
    beats: list[dict[str, Any]],
    prose: dict[str, Any] | None = None,
    findings: dict[str, int] | None = None,
) -> dict[str, Any]:
    """A reading's ``data`` from a story's state (now, or a snapshot's)."""
    story = _Row(**state["story"])
    nodes = _rows(state.get("structure_nodes", []))
    ordered, children = _ordered(nodes)
    by_id = {n.id: n for n in nodes}
    leaves = [n for n in ordered if not children.get(n.id)]
    # The charts' scenes (frontend sceneLeaves): leaves at the deepest level, or with words.
    scenes = [n for n in leaves if (n.level or 0) >= deepest or (n.word_count or 0) > 0]

    characters = _rows(state.get("characters", []))
    patterns = cast_patterns(characters)
    answers: dict[str, list[SimpleNamespace]] = {}
    for row in _rows(state.get("scene_presence", [])):
        answers.setdefault(row.node_id, []).append(row)
    carried: dict[str, list[dict[str, Any]]] = {}
    roles: dict[str, list[str]] = {}
    for a in _rows(state.get("plot_thread_appearances", [])):
        carried.setdefault(a.node_id, []).append({"id": a.thread_id, "role": a.role, "note": a.note or ""})
        roles.setdefault(a.thread_id, []).append(a.role or "moves")

    titles = {n.id: n.title or "" for n in leaves}
    blocks = [b for b in _rows(state.get("dialogue_blocks", [])) if b.dialogue_type != "thought"]
    blocks = [b for b in blocks if b.scene_id in titles]
    shares = spoken_shares(blocks, titles, {c.id: c.name for c in characters})

    written = [n for n in leaves if (n.content or "").strip()]
    missing = sum(1 for n in written if not (n.content_summary or "").strip())
    stale = sum(1 for n in written if (n.content_summary or "").strip() and n.summary_stale)

    return {
        "version": READING_VERSION,
        "story_pov": story.pov_character_id,
        "words": _words(leaves, story.intended_length or ""),
        "scenes": [
            {
                "id": n.id,
                "title": n.title or "",
                "parent_id": n.parent_id,
                "words": n.word_count or 0,
                "status": n.status or "draft",
                "pov": n.pov_character_id,
                "beat_id": n.beat_id,
                "characters": on_the_page(
                    n.content, patterns, answers.get(n.id, []), n.pov_character_id or story.pov_character_id
                ),
                "threads": carried.get(n.id, []),
            }
            for n in scenes
        ],
        "chapters": [
            {"id": pid, "title": by_id[pid].title or ""}
            for pid in dict.fromkeys(n.parent_id for n in scenes if n.parent_id in by_id)
        ],
        "characters": [
            {
                "id": c.id,
                "name": c.name or "",
                "color_slot": c.color_slot,
                "arc": {
                    "done": sum(1 for m in (c.arc_milestones or []) if m.get("completed")),
                    "total": len(c.arc_milestones or []),
                },
            }
            for c in characters
        ],
        "threads": [
            {"id": t.id, "name": t.name or "", "status": _thread_status(t, roles), "color_slot": t.color_slot}
            for t in _rows(state.get("plot_threads", []))
        ],
        "beats": beats,
        "dialogue": {
            "total_lines": shares["total_lines"],
            "unattributed": shares["unattributed"],
            "balance": shares["balance"],
            "speakers": [s.model_dump() for s in shares["speakers"]],
        },
        "prose": prose,
        "findings": findings,
        "summaries": {"fresh": len(written) - missing - stale, "stale": stale, "missing": missing},
    }


def prose_at(story_id: str, db: Session, node_ids: set[str], at: datetime | None = None) -> dict[str, Any] | None:
    """The latest prose run (at or before `at`, for an earlier version), copied for a reading."""
    if at is None:
        log = latest_runs(story_id, db).get("prose-analysis")
    else:
        log = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.story_id == story_id,
                ActivityLog.event_type.in_(RUN_EVENTS),
                ActivityLog.metadata_["feature"].as_string() == "prose-analysis",
                ActivityLog.created_at <= at,
            )
            .order_by(ActivityLog.created_at.desc())
            .first()
        )
    if log is None:
        return None
    return {"run_id": log.id, **prose_from_run(log, node_ids).model_dump(mode="json")}


def measure_now(story: Story, db: Session) -> dict[str, Any]:
    """A reading of the story as it is: its state, the latest prose run and its open findings."""
    state = reading_state(story.id, db)
    node_ids = {n["id"] for n in state["structure_nodes"]}
    return measure(
        state,
        deepest=deepest_level(story.structure_template_id, db),
        beats=beats_for(story.beat_sheet_id, db),
        prose=prose_at(story.id, db, node_ids),
        findings=dict(collect(story, db).counts_by_kind),
    )


def measure_snapshot(story: Story, data: dict[str, Any], taken_at: datetime, db: Session) -> dict[str, Any]:
    """A reading of an earlier version from its snapshot. Findings were not kept then, so none."""
    state = {key: data.get(key, []) for key in STATE_KEYS}
    state["story"] = data.get("story") or _model_to_dict(story)
    node_ids = {n["id"] for n in state["structure_nodes"]}
    return measure(
        state,
        deepest=deepest_level(state["story"].get("structure_template_id"), db),
        beats=beats_for(state["story"].get("beat_sheet_id"), db),
        prose=prose_at(story.id, db, node_ids, taken_at),
    )
