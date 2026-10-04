"""Undo / redo and the change history for a story."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.change import Change
from ..models.story import Story
from ..models.user import User
from ..services import change_log

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _result(res: change_log.UndoResult | None, verb: str) -> dict:
    if res is None:
        raise HTTPException(status_code=404, detail=f"Nothing to {verb}")
    return {"label": res.label, "entity_type": res.entity_type, "entity_ids": res.entity_ids, "batch_id": res.batch_id}


@router.get("/stories/{story_id}/undo/state")
def state(
    story_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, user)
    return change_log.undo_state(db, story_id, client_id)


@router.post("/stories/{story_id}/undo")
def undo(
    story_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
    any_client: bool = Query(default=False, description="Undo the latest change from any tab"),
):
    _story(story_id, db, user)
    try:
        res = change_log.undo_latest(db, story_id, user.id, None if any_client else client_id)
    except change_log.UndoConflict as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))
    except IntegrityError as e:
        # What it would put back points at something gone: a series this book has left.
        db.rollback()
        raise HTTPException(status_code=409, detail="That belongs to something no longer here.") from e
    return _result(res, "undo")


@router.post("/stories/{story_id}/redo")
def redo(
    story_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
    any_client: bool = Query(default=False),
):
    _story(story_id, db, user)
    try:
        res = change_log.redo_latest(db, story_id, user.id, None if any_client else client_id)
    except change_log.UndoConflict as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail="That belongs to something no longer here.") from e
    return _result(res, "redo")


@router.get("/stories/{story_id}/changes")
def list_changes(
    story_id: str,
    limit: int = Query(default=100, le=500),
    before_seq: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Newest first. ``before_seq`` pages backwards."""
    _story(story_id, db, user)
    q = db.query(Change).filter(Change.story_id == story_id)
    if before_seq is not None:
        q = q.filter(Change.seq < before_seq)
    rows = q.order_by(Change.seq.desc()).limit(limit).all()
    return [
        {
            "seq": c.seq,
            "batch_id": c.batch_id,
            "entity_type": c.entity_type,
            "entity_id": c.entity_id,
            "action": c.action,
            "label": c.label,
            "actor_id": c.actor_id,
            "client_id": c.client_id,
            "undoable": c.undoable,
            "undo_of": c.undo_of,
            "redo_of": c.redo_of,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in rows
    ]
