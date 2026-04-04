from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.location import Location, SceneSetting, PREDEFINED_LOCATION_TYPES
from ..schemas.location import (
    LocationCreate, LocationUpdate, LocationOut, LocationTree,
    SceneSettingCreate, SceneSettingOut,
)
from ..auth.dependencies import get_current_user

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_location_access(location_id: str, db: Session, user: User) -> Location:
    location = db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    story = db.query(Story).filter(Story.id == location.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


def _build_tree(location: Location) -> LocationTree:
    data = LocationTree.model_validate(location)
    data.children = [_build_tree(child) for child in sorted(location.children, key=lambda c: c.position)]
    return data


@router.get("/stories/{story_id}/locations", response_model=list[LocationTree])
def list_locations(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    roots = (
        db.query(Location)
        .filter(Location.story_id == story_id, Location.parent_id.is_(None))
        .order_by(Location.position)
        .all()
    )
    return [_build_tree(root) for root in roots]


@router.get("/stories/{story_id}/locations/flat", response_model=list[LocationOut])
def list_locations_flat(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flat list of all locations for this story — useful for pickers/dropdowns."""
    _verify_story_access(story_id, db, current_user)
    return db.query(Location).filter(Location.story_id == story_id).order_by(Location.name).all()


@router.get("/stories/{story_id}/location-types", response_model=list[str])
def get_location_types(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns predefined types plus any custom types already used in this story."""
    _verify_story_access(story_id, db, current_user)
    used = (
        db.query(Location.location_type)
        .filter(Location.story_id == story_id, Location.location_type != "")
        .distinct()
        .all()
    )
    used_types = {row[0] for row in used}
    all_types = list(PREDEFINED_LOCATION_TYPES)
    for t in used_types:
        if t not in all_types:
            all_types.append(t)
    return all_types


@router.post("/stories/{story_id}/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    story_id: str,
    body: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    location = Location(story_id=story_id, **body.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/locations/{location_id}", response_model=LocationOut)
def get_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_location_access(location_id, db, current_user)


@router.patch("/locations/{location_id}", response_model=LocationOut)
def update_location(
    location_id: str,
    body: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = _verify_location_access(location_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(location, key, value)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = _verify_location_access(location_id, db, current_user)
    db.delete(location)
    db.commit()


# --- Scene Settings ---

@router.get("/locations/{location_id}/scene-settings", response_model=list[SceneSettingOut])
def get_scene_settings_for_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_location_access(location_id, db, current_user)
    return db.query(SceneSetting).filter(SceneSetting.location_id == location_id).all()


@router.get("/structure/{node_id}/scene-settings", response_model=list[SceneSettingOut])
def get_scene_settings_for_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(SceneSetting).filter(SceneSetting.node_id == node_id).all()
    # Verify access via location -> story
    for s in settings:
        _verify_location_access(s.location_id, db, current_user)
    return settings


@router.post("/scene-settings", response_model=SceneSettingOut, status_code=status.HTTP_201_CREATED)
def add_scene_setting(
    body: SceneSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_location_access(body.location_id, db, current_user)
    # Prevent duplicates
    existing = (
        db.query(SceneSetting)
        .filter(SceneSetting.location_id == body.location_id, SceneSetting.node_id == body.node_id)
        .first()
    )
    if existing:
        return existing
    scene_setting = SceneSetting(**body.model_dump())
    db.add(scene_setting)
    db.commit()
    db.refresh(scene_setting)
    return scene_setting


@router.patch("/scene-settings/{setting_id}", response_model=SceneSettingOut)
def update_scene_setting(
    setting_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scene_setting = db.get(SceneSetting, setting_id)
    if not scene_setting:
        raise HTTPException(status_code=404, detail="Scene setting not found")
    _verify_location_access(scene_setting.location_id, db, current_user)
    for key, value in body.items():
        if hasattr(scene_setting, key):
            setattr(scene_setting, key, value)
    db.commit()
    db.refresh(scene_setting)
    return scene_setting


@router.delete("/scene-settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_scene_setting(
    setting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scene_setting = db.get(SceneSetting, setting_id)
    if not scene_setting:
        raise HTTPException(status_code=404, detail="Scene setting not found")
    _verify_location_access(scene_setting.location_id, db, current_user)
    db.delete(scene_setting)
    db.commit()
