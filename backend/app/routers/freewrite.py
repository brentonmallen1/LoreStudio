"""Freewrite (doc 15 N3): a page per story for thinking loosely.

Saved like prose: the editor's own history undoes keystrokes, so a save is not an undoable
change. What a sentence was made into (a note, a character) is, through its own route.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User

router = APIRouter()

#: A page of loose writing, not a manuscript: a ceiling keeps one paste from filling the database.
MAX_HTML = 2_000_000


class FreewriteIn(BaseModel):
    html: str


class FreewriteOut(BaseModel):
    html: str


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/freewrite", response_model=FreewriteOut)
def get_freewrite(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return FreewriteOut(html=_story(story_id, db, current_user).freewrite or "")


@router.put("/stories/{story_id}/freewrite", response_model=FreewriteOut)
def put_freewrite(
    story_id: str,
    body: FreewriteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.html) > MAX_HTML:
        raise HTTPException(status_code=413, detail="The page is too long to save")
    story = _story(story_id, db, current_user)
    story.freewrite = body.html
    db.commit()
    return FreewriteOut(html=story.freewrite)
