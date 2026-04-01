from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..schemas.plot_thread import (
    PlotThreadCreate,
    PlotThreadUpdate,
    PlotThreadAppearanceCreate,
    PlotThreadOut,
    PlotThreadAppearanceOut,
)
from ..auth.dependencies import get_current_user

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_thread(thread_id: str, db: Session, user: User) -> PlotThread:
    thread = db.get(PlotThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    _verify_story(thread.story_id, db, user)
    return thread


@router.get("/stories/{story_id}/threads", response_model=list[PlotThreadOut])
def list_threads(
    story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _verify_story(story_id, db, current_user)
    return (
        db.query(PlotThread)
        .filter(PlotThread.story_id == story_id)
        .order_by(PlotThread.created_at.asc())
        .all()
    )


@router.post("/stories/{story_id}/threads", response_model=PlotThreadOut, status_code=status.HTTP_201_CREATED)
def create_thread(
    story_id: str,
    body: PlotThreadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    thread = PlotThread(story_id=story_id, **body.model_dump())
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


@router.patch("/threads/{thread_id}", response_model=PlotThreadOut)
def update_thread(
    thread_id: str,
    body: PlotThreadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = _verify_thread(thread_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(thread, key, value)
    db.commit()
    db.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    thread = _verify_thread(thread_id, db, current_user)
    db.delete(thread)
    db.commit()


@router.post("/threads/{thread_id}/appearances", response_model=PlotThreadAppearanceOut, status_code=status.HTTP_201_CREATED)
def add_appearance(
    thread_id: str,
    body: PlotThreadAppearanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = _verify_thread(thread_id, db, current_user)
    # Prevent duplicate appearances for same node
    existing = (
        db.query(PlotThreadAppearance)
        .filter(
            PlotThreadAppearance.thread_id == thread_id,
            PlotThreadAppearance.node_id == body.node_id,
        )
        .first()
    )
    if existing:
        return existing
    appearance = PlotThreadAppearance(thread_id=thread_id, node_id=body.node_id, note=body.note)
    db.add(appearance)
    db.commit()
    db.refresh(appearance)
    return appearance


@router.delete("/threads/{thread_id}/appearances/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_appearance(
    thread_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_thread(thread_id, db, current_user)
    appearance = (
        db.query(PlotThreadAppearance)
        .filter(
            PlotThreadAppearance.thread_id == thread_id,
            PlotThreadAppearance.node_id == node_id,
        )
        .first()
    )
    if appearance:
        db.delete(appearance)
        db.commit()
