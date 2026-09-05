import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.plot_thread import PlotThread
from ..models.setting import Setting
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User

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

    # Fetch the user's stories once and build a lookup map
    user_stories = db.query(Story).filter(Story.user_id == user.id).all()
    if not user_stories:
        return results
    story_ids = [s.id for s in user_stories]
    story_map = {s.id: s for s in user_stories}

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
        results.append(
            {
                "type": "story",
                "id": s.id,
                "story_id": s.id,
                "title": s.title,
                "subtitle": s.genre or None,
                "excerpt": _excerpt(s.description, q),
            }
        )

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
        story = story_map.get(c.story_id)
        results.append(
            {
                "type": "character",
                "id": c.id,
                "story_id": c.story_id,
                "title": c.name,
                "subtitle": story.title if story else None,
                "excerpt": _excerpt(c.personality or c.motivation or c.background, q),
            }
        )

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
        story = story_map.get(n.story_id)
        # Pick the best excerpt source
        excerpt_src = ""
        if q.lower() in (n.content or "").lower():
            excerpt_src = n.content
        elif q.lower() in (n.synopsis or "").lower():
            excerpt_src = n.synopsis
        results.append(
            {
                "type": "scene",
                "id": n.id,
                "story_id": n.story_id,
                "title": n.title or "Untitled",
                "subtitle": story.title if story else None,
                "level_type": n.level_type,
                "excerpt": _excerpt(excerpt_src, q),
            }
        )

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
        story = story_map.get(s.story_id)
        results.append(
            {
                "type": "setting",
                "id": s.id,
                "story_id": s.story_id,
                "title": s.name,
                "subtitle": story.title if story else None,
                "excerpt": _excerpt(s.description, q),
            }
        )

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
        story = story_map.get(t.story_id)
        results.append(
            {
                "type": "thread",
                "id": t.id,
                "story_id": t.story_id,
                "title": t.name,
                "subtitle": story.title if story else None,
                "excerpt": _excerpt(t.description, q),
            }
        )

    return results


# ── Story-wide search ─────────────────────────────────────────────────────────


class StorySearchRequest(BaseModel):
    query: str
    case_sensitive: bool = False


class StoryReplaceRequest(BaseModel):
    query: str
    replacement: str
    case_sensitive: bool = False
    node_ids: list[str] | None = None  # None means replace in all nodes


def _count_and_excerpt(content: str, query: str, case_sensitive: bool) -> tuple[int, str]:
    """Return (match_count, excerpt) for a content string."""
    if not content:
        return 0, ""
    flags = 0 if case_sensitive else re.IGNORECASE
    plain = re.sub(r"<[^>]+>", " ", content)
    plain = re.sub(r"\s+", " ", plain).strip()
    pattern = re.escape(query)
    matches = list(re.finditer(pattern, plain, flags))
    if not matches:
        return 0, ""
    count = len(matches)
    m = matches[0]
    start = max(0, m.start() - 40)
    end = min(len(plain), m.end() + 80)
    snippet = plain[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(plain):
        snippet = snippet + "…"
    return count, snippet


@router.post("/stories/{story_id}/search")
async def story_search(
    story_id: str,
    req: StorySearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    story = db.get(Story, story_id)
    if not story or story.user_id != user.id:
        raise HTTPException(status_code=404, detail="Story not found")

    if not req.query:
        return {"matches": []}

    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    results = []
    for node in nodes:
        count, excerpt = _count_and_excerpt(node.content or "", req.query, req.case_sensitive)
        if count > 0:
            results.append(
                {
                    "node_id": node.id,
                    "node_title": node.title or "Untitled",
                    "excerpt": excerpt,
                    "match_count": count,
                    "level_type": node.level_type or "scene",
                }
            )
    results.sort(key=lambda r: r["match_count"], reverse=True)
    return {"matches": results}


@router.post("/stories/{story_id}/replace")
async def story_replace(
    story_id: str,
    req: StoryReplaceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    story = db.get(Story, story_id)
    if not story or story.user_id != user.id:
        raise HTTPException(status_code=404, detail="Story not found")

    if not req.query:
        return {"replaced_count": 0, "scenes_affected": 0}

    flags = 0 if req.case_sensitive else re.IGNORECASE
    pattern = re.escape(req.query)

    q = db.query(StructureNode).filter(StructureNode.story_id == story_id)
    if req.node_ids:
        q = q.filter(StructureNode.id.in_(req.node_ids))

    nodes = q.all()
    total_replaced = 0
    scenes_affected = 0

    for node in nodes:
        if not node.content:
            continue
        new_content, n = re.subn(pattern, req.replacement, node.content, flags=flags)
        if n > 0:
            node.content = new_content
            total_replaced += n
            scenes_affected += 1

    if scenes_affected > 0:
        db.commit()

    return {"replaced_count": total_replaced, "scenes_affected": scenes_affected}
