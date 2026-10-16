"""Organizing what is written (doc 29 D6): join a scene with the next one, and wrap scenes in a
chapter. Each is one change ⌘Z takes back whole. Splitting is `POST /structure/{id}/split`."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.structure import StructureNodeOut
from ..services import change_log
from ..services.dialogue_service import sync_scene_dialogue
from ..services.edit_conflict import changed_since
from ..services.organize import OrganizeError, merge_next, wrap_scenes

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


class MergeBody(BaseModel):
    #: The open scene as the editor last saved it: a scene changed since is not joined.
    expected_updated_at: datetime | None = None


@router.post("/structure/{node_id}/merge-next", response_model=StructureNodeOut)
def join_with_next(
    node_id: str,
    body: MergeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Join a scene with the next one in its chapter; returns the joined scene."""
    node = db.get(StructureNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    _story(node.story_id, db, user)
    if body.expected_updated_at is not None and changed_since(body.expected_updated_at, node.updated_at):
        raise HTTPException(status_code=409, detail="This scene changed since you loaded it.")
    try:
        merged = merge_next(db, node, actor_id=user.id, client_id=client_id)
    except OrganizeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    db.commit()
    db.refresh(merged)
    sync_scene_dialogue(merged, db)
    return merged


class WrapBody(BaseModel):
    node_ids: list[str]
    title: str


@router.post("/stories/{story_id}/structure/wrap", response_model=list[StructureNodeOut])
def wrap_in_a_part(
    story_id: str,
    body: WrapBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Wrap scenes that sit next to each other in a chapter (the level above scenes); returns the
    chapters made: the new one, and "(continued)" when scenes came from the middle of one."""
    story = _story(story_id, db, user)
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Give the new part a name.")
    try:
        made = wrap_scenes(db, story, body.node_ids, title, actor_id=user.id, client_id=client_id)
    except OrganizeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    db.commit()
    for part in made:
        db.refresh(part)
    return made
