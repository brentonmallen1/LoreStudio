from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.historical_event import Era, HistoricalEvent
from ..models.story import Story
from ..models.user import User
from ..schemas.historical_event import (
    EraCreate,
    EraOut,
    EraUpdate,
    HistoricalEventCreate,
    HistoricalEventOut,
    HistoricalEventUpdate,
)

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_era_access(era_id: str, db: Session, user: User) -> Era:
    era = db.get(Era, era_id)
    if not era:
        raise HTTPException(status_code=404, detail="Era not found")
    story = db.query(Story).filter(Story.id == era.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Era not found")
    return era


def _verify_event_access(event_id: str, db: Session, user: User) -> HistoricalEvent:
    event = db.get(HistoricalEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Historical event not found")
    story = db.query(Story).filter(Story.id == event.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Historical event not found")
    return event


# --- Eras ---


@router.get("/stories/{story_id}/eras", response_model=list[EraOut])
def list_eras(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return db.query(Era).filter(Era.story_id == story_id).order_by(Era.position).all()


@router.post("/stories/{story_id}/eras", response_model=EraOut, status_code=status.HTTP_201_CREATED)
def create_era(
    story_id: str,
    body: EraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    era = Era(story_id=story_id, **body.model_dump())
    db.add(era)
    db.commit()
    db.refresh(era)
    return era


@router.get("/eras/{era_id}", response_model=EraOut)
def get_era(era_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_era_access(era_id, db, current_user)


@router.patch("/eras/{era_id}", response_model=EraOut)
def update_era(
    era_id: str,
    body: EraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    era = _verify_era_access(era_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(era, key, value)
    db.commit()
    db.refresh(era)
    return era


@router.delete("/eras/{era_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_era(era_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    era = _verify_era_access(era_id, db, current_user)
    db.delete(era)
    db.commit()


# --- Historical Events ---


@router.get("/stories/{story_id}/historical-events", response_model=list[HistoricalEventOut])
def list_events(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return (
        db.query(HistoricalEvent).filter(HistoricalEvent.story_id == story_id).order_by(HistoricalEvent.position).all()
    )


@router.post(
    "/stories/{story_id}/historical-events", response_model=HistoricalEventOut, status_code=status.HTTP_201_CREATED
)
def create_event(
    story_id: str,
    body: HistoricalEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    event = HistoricalEvent(story_id=story_id, **body.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/historical-events/{event_id}", response_model=HistoricalEventOut)
def get_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_event_access(event_id, db, current_user)


@router.patch("/historical-events/{event_id}", response_model=HistoricalEventOut)
def update_event(
    event_id: str,
    body: HistoricalEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _verify_event_access(event_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/historical-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = _verify_event_access(event_id, db, current_user)
    db.delete(event)
    db.commit()
