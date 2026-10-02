import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.location import PREDEFINED_LOCATION_TYPES, Location, SceneSetting
from ..models.setting import Setting
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.location import (
    LocationCreate,
    LocationMerge,
    LocationOut,
    LocationTree,
    LocationUpdate,
    SceneSettingCreate,
    SceneSettingOut,
)
from ..services import change_log, other_names
from ..services.color_slots import next_slot
from ..services.location_merge import CannotMerge, merge_location

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
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)
    location = Location(story_id=story_id, **body.model_dump())
    if not location.color_slot:
        location.color_slot = next_slot(
            slot for (slot,) in db.query(Location.color_slot).filter(Location.story_id == story_id).all()
        )
    db.add(location)
    db.flush()
    change_log.record_row_create(
        db,
        location,
        "locations",
        entity_type="location",
        story_id=story_id,
        label=f"Add location {location.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    location = _verify_location_access(location_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    other_names.settle(location, data, "location", db)
    change_log.record_update(
        db,
        location,
        data,
        entity_type="location",
        story_id=location.story_id,
        label=f"Edit {{fields}} on location {location.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(location, key, value)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    location = _verify_location_access(location_id, db, current_user)
    change_log.record(
        db,
        story_id=location.story_id,
        entity_type="location",
        entity_id=location.id,
        action="delete",
        before=change_log.capture_location(location, db),
        after=None,
        label=f"Delete location {location.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(location)
    db.commit()


@router.post("/locations/{location_id}/merge", response_model=LocationOut)
def merge_into(
    location_id: str,
    body: LocationMerge,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """ "Same as…" (doc 13 P4): this place is another one; its scenes, routes and the places
    inside it move over, its name stays as an alias, and it goes. One Undo reverses it."""
    stub = _verify_location_access(location_id, db, current_user)
    into = _verify_location_access(body.into, db, current_user)
    try:
        return merge_location(stub, into, db, current_user.id, client_id)
    except CannotMerge as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


# --- Settings Migration ---


@router.post("/stories/{story_id}/locations/migrate-settings")
def migrate_settings_to_locations(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-time migration: convert legacy Setting records to Location stubs.
    Safe to call multiple times — skips Settings whose name already exists as a Location.
    """
    _verify_story_access(story_id, db, current_user)
    old_settings = db.query(Setting).filter(Setting.story_id == story_id).all()
    created = 0
    merged = 0
    for s in old_settings:
        existing = db.query(Location).filter(Location.story_id == story_id, Location.name == s.name).first()
        if existing:
            # Merge any non-empty fields that Location is missing
            if not existing.description and s.description:
                existing.description = s.description
            if not existing.atmosphere and s.atmosphere:
                existing.atmosphere = s.atmosphere
            if not existing.history and s.history:
                existing.history = s.history
            if not existing.significance and s.significance:
                existing.significance = s.significance
            merged += 1
        else:
            loc = Location(
                id=str(uuid.uuid4()),
                story_id=story_id,
                name=s.name,
                description=s.description or "",
                atmosphere=s.atmosphere or "",
                history=s.history or "",
                significance=s.significance or "",
                is_stub=True,
                created_at=s.created_at,
            )
            db.add(loc)
            created += 1
    db.commit()
    return {"created": created, "merged": merged}


# --- Scene Settings ---


@router.get("/locations/{location_id}/scene-settings", response_model=list[SceneSettingOut])
def get_scene_settings_for_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_location_access(location_id, db, current_user)
    return db.query(SceneSetting).filter(SceneSetting.location_id == location_id).all()


@router.get("/locations/{location_id}/scenes")
def get_scenes_for_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns scene references with titles for the Location Sheet scenes tab."""
    _verify_location_access(location_id, db, current_user)
    settings = db.query(SceneSetting).filter(SceneSetting.location_id == location_id).all()
    result = []
    for s in settings:
        node = db.get(StructureNode, s.node_id)
        result.append(
            {
                "scene_setting_id": s.id,
                "scene_id": s.node_id,
                "scene_title": node.title if node else "Untitled",
                "role": s.role,
                "notes": s.notes,
            }
        )
    return result


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
