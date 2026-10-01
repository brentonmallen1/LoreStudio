from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..schemas.numbers import NumbersOut
from ..services.numbers import numbers

router = APIRouter()


@router.get("/stories/{story_id}/numbers", response_model=NumbersOut)
def story_numbers(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The story in numbers (doc 13 P3): words, dialogue, prose and summaries."""
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    out = numbers(story, db)
    # Reading the dialogue brings its blocks up to date with the prose first.
    db.commit()
    return out
