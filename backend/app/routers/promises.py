from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..schemas.promises import PromisesOut
from ..services.promises import promises_view

router = APIRouter()


@router.get("/stories/{story_id}/promises", response_model=PromisesOut)
def story_promises(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Every promise the story makes, in reading order (doc 18 C2): the tapestry reads this."""
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return promises_view(story_id, db)
