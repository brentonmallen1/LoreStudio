"""Non-AI manuscript tools: quote normalisation. Consistency checks are in the findings feed."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.scene_take import SceneTake
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..services import change_log, takes
from ..services.text_utils import count_quote_styles, normalize_quotes_html

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


class NormalizeQuotesRequest(BaseModel):
    style: str = "curly"  # curly | straight
    node_ids: list[str] | None = None
    dry_run: bool = False


@router.get("/stories/{story_id}/quotes")
def quote_styles(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """How many straight vs curly quote characters the manuscript uses, per scene."""
    _story(story_id, db, user)
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    per_node = []
    total = {"straight": 0, "curly": 0}
    for n in nodes:
        if not n.content:
            continue
        counts = count_quote_styles(n.content)
        if counts["straight"] or counts["curly"]:
            per_node.append({"node_id": n.id, "title": n.title, **counts})
            total["straight"] += counts["straight"]
            total["curly"] += counts["curly"]
    return {"total": total, "nodes": per_node, "mixed": bool(total["straight"] and total["curly"])}


@router.post("/stories/{story_id}/quotes/normalize")
def normalize_quotes(
    story_id: str,
    req: NormalizeQuotesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Convert quotes in the prose to one style. Markup and speaker tags are untouched."""
    if req.style not in ("curly", "straight"):
        raise HTTPException(status_code=400, detail="style must be 'curly' or 'straight'")
    _story(story_id, db, user)
    q = db.query(StructureNode).filter(StructureNode.story_id == story_id)
    if req.node_ids:
        q = q.filter(StructureNode.id.in_(req.node_ids))
    changed_chars = 0
    scenes: list[dict] = []
    rewrites: list[tuple[StructureNode, str]] = []
    nodes = q.all()
    for node in nodes:
        if not node.content:
            continue
        new_html, n = normalize_quotes_html(node.content, req.style)
        if n:
            scenes.append({"node_id": node.id, "title": node.title, "changed": n})
            changed_chars += n
            rewrites.append((node, new_html))
    # The scenes' other takes (doc 29 D7) too, so a take chosen later has the same quotes.
    take_rewrites: list[tuple[SceneTake, str]] = []
    for take in [] if req.dry_run else takes.others(db, story_id, req.node_ids or None):
        new_html, n = normalize_quotes_html(take.content or "", req.style)
        if n:
            take_rewrites.append((take, new_html))
    changed = list(dict.fromkeys([node.id for node, _ in rewrites] + [take.node_id for take, _ in take_rewrites]))
    if req.dry_run:
        changed = []
    if changed:
        # One batch, one name: ⌘Z takes back the whole conversion.
        titles = {node.id: node.title for node in nodes}
        where = f"“{titles[changed[0]]}”" if len(changed) == 1 else f"{len(changed)} scenes"
        write = change_log.prose_writer(
            db,
            label=f"{req.style.capitalize()} quotes in {where}",
            batch_id=str(uuid.uuid4()),
            actor_id=user.id,
            client_id=client_id,
        )
        for target, new_html in [*rewrites, *take_rewrites]:
            write(target, new_html)
        db.commit()
    return {
        "style": req.style,
        "dry_run": req.dry_run,
        "changed_chars": changed_chars,
        "scenes": scenes,
        # Every scene rewritten, its other takes included, for an editor holding one to reload.
        "node_ids": changed,
    }
