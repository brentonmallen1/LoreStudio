from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.world_system import WorldSystem, PREDEFINED_SYSTEM_TYPES
from ..schemas.world_system import WorldSystemCreate, WorldSystemUpdate, WorldSystemOut
from ..auth.dependencies import get_current_user

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_system_access(system_id: str, db: Session, user: User) -> WorldSystem:
    system = db.get(WorldSystem, system_id)
    if not system:
        raise HTTPException(status_code=404, detail="World system not found")
    story = db.query(Story).filter(Story.id == system.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="World system not found")
    return system


@router.get("/stories/{story_id}/world-systems", response_model=list[WorldSystemOut])
def list_world_systems(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return (
        db.query(WorldSystem)
        .filter(WorldSystem.story_id == story_id)
        .order_by(WorldSystem.name)
        .all()
    )


@router.get("/stories/{story_id}/world-system-types", response_model=list[str])
def get_system_types(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns predefined types plus any custom types already used in this story."""
    _verify_story_access(story_id, db, current_user)
    used = (
        db.query(WorldSystem.system_type)
        .filter(WorldSystem.story_id == story_id, WorldSystem.system_type != "")
        .distinct()
        .all()
    )
    used_types = {row[0] for row in used}
    all_types = list(PREDEFINED_SYSTEM_TYPES)
    for t in used_types:
        if t not in all_types:
            all_types.append(t)
    return all_types


@router.post("/stories/{story_id}/world-systems", response_model=WorldSystemOut, status_code=status.HTTP_201_CREATED)
def create_world_system(
    story_id: str,
    body: WorldSystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    system = WorldSystem(story_id=story_id, **body.model_dump())
    db.add(system)
    db.commit()
    db.refresh(system)
    return system


@router.get("/world-systems/{system_id}", response_model=WorldSystemOut)
def get_world_system(
    system_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_system_access(system_id, db, current_user)


@router.patch("/world-systems/{system_id}", response_model=WorldSystemOut)
def update_world_system(
    system_id: str,
    body: WorldSystemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    system = _verify_system_access(system_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(system, key, value)
    db.commit()
    db.refresh(system)
    return system


@router.delete("/world-systems/{system_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_world_system(
    system_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    system = _verify_system_access(system_id, db, current_user)
    db.delete(system)
    db.commit()
