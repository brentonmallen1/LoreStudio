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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..models.plot_thread import PlotThread
from ..services.word_count import get_word_count_status
from ..services.mice_validation import validate_thread_nesting

from ..auth.dependencies import get_current_user

router = APIRouter()

RECENT_SCENE_WINDOW = 5  # "absent" = not in last N leaf scenes


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
    all_nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story_id)
        .all()
    )
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

    # ── Pacing heat map (leaf scenes in order) ──
    pacing = [
        {
            "id": n.id,
            "title": n.title,
            "word_count": n.word_count,
            "status": n.status,
            "level_type": n.level_type,
            "beat_id": n.beat_id,
        }
        for n in leaves
    ]

    # ── Character screen time ──
    # Count scenes (leaf nodes with content) where the character is @mentioned or name appears
    recent_leaves = leaves[-RECENT_SCENE_WINDOW:] if len(leaves) >= RECENT_SCENE_WINDOW else leaves
    recent_leaf_ids = {n.id for n in recent_leaves}

    char_screen_time = []
    absent_characters = []

    for c in characters:
        name_lower = c.name.lower()
        scene_count = sum(
            1 for n in leaves
            if n.content and name_lower in n.content.lower()
        )
        recent_count = sum(
            1 for n in recent_leaves
            if n.content and name_lower in n.content.lower()
        )

        # Arc milestone progress
        milestones = c.arc_milestones or []
        total_ms = len(milestones)
        done_ms = sum(1 for m in milestones if m.get("completed"))
        arc_pct = round(done_ms / total_ms * 100) if total_ms else None

        char_screen_time.append({
            "id": c.id,
            "name": c.name,
            "role": c.role,
            "scene_appearances": scene_count,
            "recent_appearances": recent_count,
            "arc_milestones_total": total_ms,
            "arc_milestones_done": done_ms,
            "arc_pct": arc_pct,
        })

        # Flag as absent if they have content scenes but haven't appeared recently
        written_leaves = [n for n in leaves if n.word_count > 0]
        if (
            len(written_leaves) >= RECENT_SCENE_WINDOW
            and scene_count > 0
            and recent_count == 0
            and c.role in ("protagonist", "antagonist", "supporting")
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
        thread_health[t.status].append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "mice_type": t.mice_type,
            "try_fail_cycle_count": len(t.try_fail_cycles or []),
        })

    # ── Story goals ──
    goals = story.goals or []
    goals_total = len(goals)
    goals_done = sum(1 for g in goals if g.get("completed"))

    # ── Word count target ──
    word_count_target = get_word_count_status(story.intended_length or "", total_words)

    # ── MICE nesting validation ──
    leaf_order = [n.id for n in leaves]
    mice_violations = validate_thread_nesting(threads, leaf_order)

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
