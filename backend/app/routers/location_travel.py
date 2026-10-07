from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.location import Location
from ..models.location_travel import LocationTravel
from ..models.story import Story
from ..models.user import User
from ..schemas.location_travel import LocationTravelCreate, LocationTravelOut, LocationTravelUpdate
from ..services import change_log

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


def _verify_travel_access(travel_id: str, db: Session, user: User) -> LocationTravel:
    travel = db.get(LocationTravel, travel_id)
    if not travel:
        raise HTTPException(status_code=404, detail="Travel entry not found")
    _verify_location_access(travel.from_location_id, db, user)
    return travel


def _route_name(travel: LocationTravel) -> str:
    return f"{travel.from_location.name} to {travel.to_location.name}"


@router.get("/stories/{story_id}/location-travel", response_model=list[LocationTravelOut])
def list_travel(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    # Get all location IDs for this story, then filter travel entries
    location_ids = [row[0] for row in db.query(Location.id).filter(Location.story_id == story_id).all()]
    return db.query(LocationTravel).filter(LocationTravel.from_location_id.in_(location_ids)).all()


@router.post("/location-travel", response_model=LocationTravelOut, status_code=status.HTTP_201_CREATED)
def create_travel(
    body: LocationTravelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    origin = _verify_location_access(body.from_location_id, db, current_user)
    destination = _verify_location_access(body.to_location_id, db, current_user)
    travel = LocationTravel(**body.model_dump())
    db.add(travel)
    db.flush()
    change_log.record_row_create(
        db,
        travel,
        "location_travel",
        entity_type="location_travel",
        story_id=origin.story_id,
        label=f"Add route {origin.name} to {destination.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(travel)
    return travel


@router.patch("/location-travel/{travel_id}", response_model=LocationTravelOut)
def update_travel(
    travel_id: str,
    body: LocationTravelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    travel = _verify_travel_access(travel_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        travel,
        data,
        entity_type="location_travel",
        story_id=travel.from_location.story_id,
        label=f"Edit {{fields}} on route {_route_name(travel)}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(travel, key, value)
    db.commit()
    db.refresh(travel)
    return travel


@router.delete("/location-travel/{travel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_travel(
    travel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    travel = _verify_travel_access(travel_id, db, current_user)
    change_log.record_row_delete(
        db,
        travel,
        "location_travel",
        entity_type="location_travel",
        story_id=travel.from_location.story_id,
        label=f"Delete route {_route_name(travel)}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(travel)
    db.commit()
