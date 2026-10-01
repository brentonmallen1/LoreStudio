"""Non-AI manuscript tools: quote normalisation. Consistency checks are in the findings feed."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..services import change_log
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
    batch_id = str(uuid.uuid4())
    for node in q.all():
        if not node.content:
            continue
        new_html, n = normalize_quotes_html(node.content, req.style)
        if n:
            scenes.append({"node_id": node.id, "title": node.title, "changed": n})
            changed_chars += n
            if not req.dry_run:
                change_log.rewrite_prose(
                    db,
                    node,
                    new_html,
                    label=f"{req.style.capitalize()} quotes in “{node.title}”",
                    batch_id=batch_id,
                    actor_id=user.id,
                    client_id=client_id,
                )
    if scenes and not req.dry_run:
        db.commit()
    return {"style": req.style, "dry_run": req.dry_run, "changed_chars": changed_chars, "scenes": scenes}
