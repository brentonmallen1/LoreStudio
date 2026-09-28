"""
Story Health Dashboard endpoint.

Computes purely from stored data — no AI required.  Returns a JSON payload
the frontend renders as a dashboard:

  - word_count_total / by_status
  - scene_count / by_status
  - pacing: per-scene word count ordered by position (heat-map data)
  - character_screen_time: how many scenes each character appears in
  - arc_progress: milestone completion % per character
  - thread_health: open / developing / resolved counts + unresolved names
  - goals_progress: completed vs total
  - absent_characters: characters with no appearances in the last N scenes
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..services.codex.presence import name_patterns
from ..services.mice_validation import validate_thread_nesting
from ..services.word_count import get_word_count_status

router = APIRouter()

RECENT_SCENE_WINDOW = 5  # "absent" = not in last N leaf scenes
# Tertiary characters are intentionally background-only — don't flag their absence
SIGNIFICANT_ROLES = {"protagonist", "deuteragonist", "antagonist", "love_interest", "confidant", "foil"}


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _flatten_leaves(
    nodes: list[StructureNode],
    children_map: dict[str, list[StructureNode]],
) -> list[StructureNode]:
    """Return leaf nodes (no children) in position order, recursively.
    Uses an explicit children_map so we never touch the ORM relationship.
    """
    leaves = []

    def walk(ns: list[StructureNode]):
        for n in sorted(ns, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                leaves.append(n)
            else:
                walk(kids)

    walk(nodes)
    return leaves


@router.get("/stories/{story_id}/health")
def story_health(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = _get_story(story_id, db, current_user)

    # Load everything
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()

    # Build a parent→children map without touching the ORM relationship.
    children_map: dict[str, list[StructureNode]] = {}
    roots: list[StructureNode] = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    leaves = _flatten_leaves(roots, children_map)

    # ── Word counts ──
    total_words = sum(n.word_count for n in all_nodes)
    words_by_status = {"draft": 0, "revised": 0, "final": 0}
    scenes_by_status = {"draft": 0, "revised": 0, "final": 0}
    for n in leaves:
        words_by_status[n.status] = words_by_status.get(n.status, 0) + n.word_count
        scenes_by_status[n.status] = scenes_by_status.get(n.status, 0) + 1

    # ── Character-per-scene map (name match in content) ──
    char_scene_map: dict[str, list[str]] = {}  # scene_id → [char_name, ...]
    for c in characters:
        name_lower = c.name.lower()
        for leaf in leaves:
            if leaf.content and name_lower in leaf.content.lower():
                char_scene_map.setdefault(leaf.id, []).append(c.name)

    # ── Pacing heat map (leaf scenes in order) ──
    pacing = [
        {
            "id": n.id,
            "title": n.title,
            "word_count": n.word_count,
            "status": n.status,
            "level_type": n.level_type,
            "beat_id": n.beat_id,
            "character_names": char_scene_map.get(n.id, []),
        }
        for n in leaves
    ]

    # ── Character screen time ──
    # Count scenes (leaf nodes with content) where the character is @mentioned or name appears
    recent_leaves = leaves[-RECENT_SCENE_WINDOW:] if len(leaves) >= RECENT_SCENE_WINDOW else leaves

    char_screen_time: list[dict[str, Any]] = []
    absent_characters = []

    # The Codex's name forms: "Eleanor" for Eleanor Vance, either half of "The Visitor
    # (Calder)", and no form two characters share. Matching the full label found almost
    # nobody — the Visitor was in 0 scenes of a story she drives.
    patterns = name_patterns({c.id: c.name for c in characters})

    def appears(c_id: str, node) -> bool:
        return bool(node.content) and any(p.search(node.content) for p in patterns.get(c_id, []))

    for c in characters:
        scene_count = sum(1 for n in leaves if appears(c.id, n))
        recent_count = sum(1 for n in recent_leaves if appears(c.id, n))

        # Arc milestone progress
        milestones = c.arc_milestones or []
        total_ms = len(milestones)
        done_ms = sum(1 for m in milestones if m.get("completed"))
        arc_pct = round(done_ms / total_ms * 100) if total_ms else None

        char_screen_time.append(
            {
                "id": c.id,
                "name": c.name,
                "role": c.role,
                "scene_appearances": scene_count,
                "recent_appearances": recent_count,
                "arc_milestones_total": total_ms,
                "arc_milestones_done": done_ms,
                "arc_pct": arc_pct,
            }
        )

        # Flag as absent if they have content scenes but haven't appeared recently
        written_leaves = [n for n in leaves if n.word_count > 0]
        if (
            len(written_leaves) >= RECENT_SCENE_WINDOW
            and scene_count > 0
            and recent_count == 0
            and c.role in SIGNIFICANT_ROLES
        ):
            absent_characters.append(c.name)

    # Sort by total appearances descending
    char_screen_time.sort(key=lambda x: x["scene_appearances"], reverse=True)

    # ── Plot thread health ──
    thread_health = {
        "open": [],
        "developing": [],
        "resolved": [],
    }
    for t in threads:
        thread_health[t.status].append(
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "mice_type": t.mice_type,
                "try_fail_cycle_count": len(t.try_fail_cycles or []),
            }
        )

    # ── Story goals ──
    goals = story.goals or []
    goals_total = len(goals)
    goals_done = sum(1 for g in goals if g.get("completed"))

    # ── Word count target ──
    word_count_target = get_word_count_status(story.intended_length or "", total_words)

    # ── MICE nesting validation ──
    leaf_order = [n.id for n in leaves]
    mice_violations = validate_thread_nesting(threads, leaf_order)

    # ── Scene summary stats ──
    content_leaves = [n for n in leaves if n.content and n.content.strip()]
    summary_fresh = sum(1 for n in content_leaves if n.content_summary and not n.summary_stale)
    summary_stale = sum(1 for n in content_leaves if n.content_summary and n.summary_stale)
    summary_missing = sum(1 for n in content_leaves if not n.content_summary)
    summary_timestamps = [n.summary_updated_at for n in content_leaves if n.summary_updated_at]
    summary_last_updated = max(summary_timestamps).isoformat() if summary_timestamps else None

    return {
        "intended_length": story.intended_length or "",
        "word_count": {
            "total": total_words,
            "by_status": words_by_status,
            "target": word_count_target,
        },
        "scenes": {
            "total": len(leaves),
            "by_status": scenes_by_status,
        },
        "scene_summaries": {
            "total": len(content_leaves),
            "fresh": summary_fresh,
            "stale": summary_stale,
            "missing": summary_missing,
            "last_updated": summary_last_updated,
        },
        "pacing": pacing,
        "characters": char_screen_time,
        "absent_characters": absent_characters,
        "threads": thread_health,
        "goals": {
            "total": goals_total,
            "done": goals_done,
            "items": goals,
        },
        "mice_violations": mice_violations,
    }


@router.get("/stories/{story_id}/health/alerts")
def story_health_alerts(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight endpoint returning only health alert counts for sidebar badge."""
    _get_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()

    children_map: dict[str, list[StructureNode]] = {}
    roots: list[StructureNode] = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)
    leaves = _flatten_leaves(roots, children_map)

    recent_leaves = leaves[-RECENT_SCENE_WINDOW:] if len(leaves) >= RECENT_SCENE_WINDOW else leaves
    written_leaves = [n for n in leaves if n.word_count > 0]

    absent_characters = []
    # The Codex's name forms: "Eleanor" for Eleanor Vance, either half of "The Visitor
    # (Calder)", and no form two characters share. Matching the full label found almost
    # nobody — the Visitor was in 0 scenes of a story she drives.
    patterns = name_patterns({c.id: c.name for c in characters})

    def appears(c_id: str, node) -> bool:
        return bool(node.content) and any(p.search(node.content) for p in patterns.get(c_id, []))

    for c in characters:
        scene_count = sum(1 for n in leaves if appears(c.id, n))
        recent_count = sum(1 for n in recent_leaves if appears(c.id, n))
        if (
            len(written_leaves) >= RECENT_SCENE_WINDOW
            and scene_count > 0
            and recent_count == 0
            and c.role in SIGNIFICANT_ROLES
        ):
            absent_characters.append(c.name)

    leaf_order = [n.id for n in leaves]
    mice_violations = validate_thread_nesting(threads, leaf_order)

    count = len(absent_characters) + len(mice_violations)
    return {
        "count": count,
        "absent_characters": absent_characters,
        "mice_violation_count": len(mice_violations),
    }
