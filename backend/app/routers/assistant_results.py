"""Kept Assistant answers (A6, A7): read a subject's answers, and clear one.

They are written by the feature routes themselves (`assistant_results.keep`), so asking
again is running the feature again; there is nothing to create here.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..services import assistant_results

router = APIRouter()


class AssistantResultOut(BaseModel):
    id: str
    subject_type: str
    subject_id: str
    feature: str
    heading: str
    data: dict
    ai_call_log_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/assistant-results", response_model=list[AssistantResultOut])
def list_results(
    story_id: str,
    subject_type: str = Query(...),
    subject_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A subject's kept answers, the newest first; without `subject_id`, every answer about a
    thing of that type (the Compendium's images, read in one call)."""
    _story(story_id, db, current_user)
    if subject_type not in assistant_results.SUBJECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown subject type {subject_type!r}")
    return assistant_results.for_subject(db, story_id, subject_type, subject_id)


@router.delete("/stories/{story_id}/assistant-results/{result_id}", status_code=204)
def clear_result(
    story_id: str,
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear one kept answer. Not undoable: it is an AI answer, and asking again brings it back."""
    _story(story_id, db, current_user)
    if not assistant_results.clear(db, story_id, result_id):
        raise HTTPException(status_code=404, detail="Answer not found")
    return Response(status_code=204)
