import uuid

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
from ..models.twist import Twist
from ..models.user import User
from ..services import change_log
from ..services.prose_html import paragraphs
from ..services.prose_rewrite import find_in_text, replace_words
from ..services.prose_syntax import reader_text
from ..services.text_utils import html_to_text

router = APIRouter()

EXCERPT_LEN = 120


def _excerpt(text: str, query: str) -> str:
    """Return a short snippet around the first match of query in text. Prose is stored as
    HTML; the snippet is read as words, so the tags go first (doc 13 P7)."""
    if not text:
        return ""
    if "<" in text:
        text = html_to_text(text)
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

    # Twists (doc 18 C8): by name, the truth or the misdirection
    twists = (
        db.query(Twist)
        .filter(
            Twist.story_id.in_(story_ids),
            or_(Twist.name.ilike(like), Twist.the_truth.ilike(like), Twist.the_misdirection.ilike(like)),
        )
        .limit(5)
        .all()
    )
    for tw in twists:
        story = story_map.get(tw.story_id)
        # Show where the word is; a match on the name shows the truth.
        in_cover = q.lower() in (tw.the_misdirection or "").lower() and q.lower() not in (tw.the_truth or "").lower()
        results.append(
            {
                "type": "twist",
                "id": tw.id,
                "story_id": tw.story_id,
                "title": tw.name,
                "subtitle": story.title if story else None,
                "excerpt": _excerpt(tw.the_misdirection if in_cover else tw.the_truth, q),
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
    whole_word: bool = False
    node_ids: list[str] | None = None  # None means replace in all nodes


def _count_and_excerpt(content: str, query: str, case_sensitive: bool) -> tuple[int, str]:
    """(matches, an excerpt round the first): in the prose as read, never in its tags, so
    the count is what Replace would change (services/prose_rewrite)."""
    count, snippet = 0, ""
    for p in paragraphs(content or ""):
        spans = find_in_text(p.text, query, case_sensitive=case_sensitive)
        if spans and not snippet:
            a, b = spans[0]
            start, end = max(0, a - 40), min(len(p.text), b + 80)
            # Shown as a reader sees it: no "@", no "[[ ]]", no "<Name>".
            words = reader_text(p.text[start:end]).strip()
            snippet = ("…" if start > 0 else "") + words + ("…" if end < len(p.text) else "")
        count += len(spans)
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = db.get(Story, story_id)
    if not story or story.user_id != user.id:
        raise HTTPException(status_code=404, detail="Story not found")

    if not req.query:
        return {"replaced_count": 0, "scenes_affected": 0, "node_ids": []}

    q = db.query(StructureNode).filter(StructureNode.story_id == story_id)
    if req.node_ids:
        q = q.filter(StructureNode.id.in_(req.node_ids))

    nodes = q.all()
    total_replaced = 0
    rewrites: list[tuple[StructureNode, str]] = []

    for node in nodes:
        if not node.content:
            continue
        new_content, n = replace_words(
            node.content, req.query, req.replacement, case_sensitive=req.case_sensitive, whole_word=req.whole_word
        )
        if n > 0:
            rewrites.append((node, new_content))
            total_replaced += n

    # One batch, one name: ⌘Z takes back the whole replace, and says what it was.
    where = f"“{rewrites[0][0].title}”" if len(rewrites) == 1 else f"{len(rewrites)} scenes"
    label = f"Replace “{req.query}” with “{req.replacement}” in {where}"
    batch_id = str(uuid.uuid4())
    for node, new_content in rewrites:
        change_log.rewrite_prose(
            db, node, new_content, label=label, batch_id=batch_id, actor_id=user.id, client_id=client_id
        )
    changed = [node.id for node, _ in rewrites]
    if changed:
        db.commit()

    # Which scenes changed, so an editor holding one of them can reload it instead of
    # saving its stale copy back over the replacement.
    return {"replaced_count": total_replaced, "scenes_affected": len(changed), "node_ids": changed}
