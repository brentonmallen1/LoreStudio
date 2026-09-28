from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.calendar import Calendar
from ..models.story import Story
from ..models.user import User
from ..schemas.calendar import CalendarCreate, CalendarOut, CalendarUpdate
from ..services import change_log

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_calendar_access(calendar_id: str, db: Session, user: User) -> Calendar:
    calendar = db.get(Calendar, calendar_id)
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")
    story = db.query(Story).filter(Story.id == calendar.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Calendar not found")
    return calendar


@router.get("/stories/{story_id}/calendars", response_model=list[CalendarOut])
def list_calendars(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return db.query(Calendar).filter(Calendar.story_id == story_id).order_by(Calendar.name).all()


@router.post("/stories/{story_id}/calendars", response_model=CalendarOut, status_code=status.HTTP_201_CREATED)
def create_calendar(
    story_id: str,
    body: CalendarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)
    calendar = Calendar(story_id=story_id, **body.model_dump())
    db.add(calendar)
    db.flush()
    change_log.record_row_create(
        db,
        calendar,
        "calendars",
        entity_type="calendar",
        story_id=story_id,
        label=f"Add calendar {calendar.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(calendar)
    return calendar


@router.get("/calendars/{calendar_id}", response_model=CalendarOut)
def get_calendar(
    calendar_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_calendar_access(calendar_id, db, current_user)


@router.patch("/calendars/{calendar_id}", response_model=CalendarOut)
def update_calendar(
    calendar_id: str,
    body: CalendarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    calendar = _verify_calendar_access(calendar_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        calendar,
        data,
        entity_type="calendar",
        story_id=calendar.story_id,
        label=f"Edit {{fields}} on calendar {calendar.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(calendar, key, value)
    db.commit()
    db.refresh(calendar)
    return calendar


@router.delete("/calendars/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar(
    calendar_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    calendar = _verify_calendar_access(calendar_id, db, current_user)
    change_log.record_row_delete(
        db,
        calendar,
        "calendars",
        entity_type="calendar",
        story_id=calendar.story_id,
        label=f"Delete calendar {calendar.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(calendar)
    db.commit()
