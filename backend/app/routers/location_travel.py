from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.location import Location
from ..models.location_travel import LocationTravel
from ..schemas.location_travel import LocationTravelCreate, LocationTravelUpdate, LocationTravelOut
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


def _verify_travel_access(travel_id: str, db: Session, user: User) -> LocationTravel:
    travel = db.get(LocationTravel, travel_id)
    if not travel:
        raise HTTPException(status_code=404, detail="Travel entry not found")
    _verify_location_access(travel.from_location_id, db, user)
    return travel


@router.get("/stories/{story_id}/location-travel", response_model=list[LocationTravelOut])
def list_travel(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    # Get all location IDs for this story, then filter travel entries
    location_ids = [
        row[0]
        for row in db.query(Location.id).filter(Location.story_id == story_id).all()
    ]
    return (
        db.query(LocationTravel)
        .filter(LocationTravel.from_location_id.in_(location_ids))
        .all()
    )


@router.post("/location-travel", response_model=LocationTravelOut, status_code=status.HTTP_201_CREATED)
def create_travel(
    body: LocationTravelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_location_access(body.from_location_id, db, current_user)
    _verify_location_access(body.to_location_id, db, current_user)
    travel = LocationTravel(**body.model_dump())
    db.add(travel)
    db.commit()
    db.refresh(travel)
    return travel


@router.patch("/location-travel/{travel_id}", response_model=LocationTravelOut)
def update_travel(
    travel_id: str,
    body: LocationTravelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    travel = _verify_travel_access(travel_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(travel, key, value)
    db.commit()
    db.refresh(travel)
    return travel


@router.delete("/location-travel/{travel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_travel(
    travel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    travel = _verify_travel_access(travel_id, db, current_user)
    db.delete(travel)
    db.commit()
