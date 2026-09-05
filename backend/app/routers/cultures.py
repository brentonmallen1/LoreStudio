from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.culture import Culture
from ..models.story import Story
from ..models.user import User
from ..schemas.culture import CultureCreate, CultureOut, CultureUpdate

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_culture_access(culture_id: str, db: Session, user: User) -> Culture:
    culture = db.get(Culture, culture_id)
    if not culture:
        raise HTTPException(status_code=404, detail="Culture not found")
    story = db.query(Story).filter(Story.id == culture.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Culture not found")
    return culture


@router.get("/stories/{story_id}/cultures", response_model=list[CultureOut])
def list_cultures(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return db.query(Culture).filter(Culture.story_id == story_id).order_by(Culture.name).all()


@router.post("/stories/{story_id}/cultures", response_model=CultureOut, status_code=status.HTTP_201_CREATED)
def create_culture(
    story_id: str,
    body: CultureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    culture = Culture(story_id=story_id, **body.model_dump())
    db.add(culture)
    db.commit()
    db.refresh(culture)
    return culture


@router.get("/cultures/{culture_id}", response_model=CultureOut)
def get_culture(
    culture_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_culture_access(culture_id, db, current_user)


@router.patch("/cultures/{culture_id}", response_model=CultureOut)
def update_culture(
    culture_id: str,
    body: CultureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    culture = _verify_culture_access(culture_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(culture, key, value)
    db.commit()
    db.refresh(culture)
    return culture


@router.delete("/cultures/{culture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_culture(
    culture_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    culture = _verify_culture_access(culture_id, db, current_user)
    db.delete(culture)
    db.commit()
