from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character
from ..models.structure import StructureNode
from ..models.setting import Setting
from ..models.plot_thread import PlotThread
from ..auth.dependencies import get_current_user

router = APIRouter()

EXCERPT_LEN = 120


def _excerpt(text: str, query: str) -> str:
    """Return a short snippet around the first match of query in text."""
    if not text:
        return ""
    lower = text.lower()
    idx = lower.find(query.lower())
    if idx == -1:
        return text[:EXCERPT_LEN].rstrip() + ("…" if len(text) > EXCERPT_LEN else "")
    start = max(0, idx - 40)
    end = min(len(text), idx + len(query) + 80)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    results = []
    like = f"%{q}%"

    # Fetch the user's story IDs once
    story_ids = [s.id for s in db.query(Story.id).filter(Story.user_id == user.id).all()]
    if not story_ids:
        return results

    # Stories
    stories = (
        db.query(Story)
        .filter(
            Story.user_id == user.id,
            or_(Story.title.ilike(like), Story.description.ilike(like), Story.genre.ilike(like)),
        )
        .limit(5)
        .all()
    )
    for s in stories:
        results.append({
            "type": "story",
            "id": s.id,
            "story_id": s.id,
            "title": s.title,
            "subtitle": s.genre or None,
            "excerpt": _excerpt(s.description, q),
        })

    # Characters
    characters = (
        db.query(Character)
        .filter(
            Character.story_id.in_(story_ids),
            or_(
                Character.name.ilike(like),
                Character.role.ilike(like),
                Character.personality.ilike(like),
                Character.motivation.ilike(like),
                Character.background.ilike(like),
            ),
        )
        .limit(8)
        .all()
    )
    for c in characters:
        story = db.get(Story, c.story_id)
        results.append({
            "type": "character",
            "id": c.id,
            "story_id": c.story_id,
            "title": c.name,
            "subtitle": story.title if story else None,
            "excerpt": _excerpt(c.personality or c.motivation or c.background, q),
        })

    # Structure nodes (scenes, chapters, etc.)
    nodes = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id.in_(story_ids),
            or_(
                StructureNode.title.ilike(like),
                StructureNode.synopsis.ilike(like),
                StructureNode.content.ilike(like),
            ),
        )
        .limit(8)
        .all()
    )
    for n in nodes:
        story = db.get(Story, n.story_id)
        # Pick the best excerpt source
        excerpt_src = ""
        if q.lower() in (n.content or "").lower():
            excerpt_src = n.content
        elif q.lower() in (n.synopsis or "").lower():
            excerpt_src = n.synopsis
        results.append({
            "type": "scene",
            "id": n.id,
            "story_id": n.story_id,
            "title": n.title or "Untitled",
            "subtitle": story.title if story else None,
            "level_type": n.level_type,
            "excerpt": _excerpt(excerpt_src, q),
        })

    # Settings
    settings = (
        db.query(Setting)
        .filter(
            Setting.story_id.in_(story_ids),
            or_(
                Setting.name.ilike(like),
                Setting.description.ilike(like),
                Setting.atmosphere.ilike(like),
            ),
        )
        .limit(5)
        .all()
    )
    for s in settings:
        story = db.get(Story, s.story_id)
        results.append({
            "type": "setting",
            "id": s.id,
            "story_id": s.story_id,
            "title": s.name,
            "subtitle": story.title if story else None,
            "excerpt": _excerpt(s.description, q),
        })

    # Plot threads
    threads = (
        db.query(PlotThread)
        .filter(
            PlotThread.story_id.in_(story_ids),
            or_(PlotThread.name.ilike(like), PlotThread.description.ilike(like)),
        )
        .limit(5)
        .all()
    )
    for t in threads:
        story = db.get(Story, t.story_id)
        results.append({
            "type": "thread",
            "id": t.id,
            "story_id": t.story_id,
            "title": t.name,
            "subtitle": story.title if story else None,
            "excerpt": _excerpt(t.description, q),
        })

    return results
