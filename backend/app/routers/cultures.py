from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.culture import Culture
from ..models.story import Story
from ..models.user import User
from ..schemas.culture import CultureCreate, CultureOut, CultureUpdate
from ..services import change_log

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
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)
    culture = Culture(story_id=story_id, **body.model_dump())
    db.add(culture)
    db.flush()
    change_log.record_row_create(
        db,
        culture,
        "cultures",
        entity_type="culture",
        story_id=story_id,
        label=f"Add culture {culture.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    culture = _verify_culture_access(culture_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        culture,
        data,
        entity_type="culture",
        story_id=culture.story_id,
        label=f"Edit {{fields}} on culture {culture.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(culture, key, value)
    db.commit()
    db.refresh(culture)
    return culture


@router.delete("/cultures/{culture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_culture(
    culture_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    culture = _verify_culture_access(culture_id, db, current_user)
    change_log.record_row_delete(
        db,
        culture,
        "cultures",
        entity_type="culture",
        story_id=culture.story_id,
        label=f"Delete culture {culture.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(culture)
    db.commit()
