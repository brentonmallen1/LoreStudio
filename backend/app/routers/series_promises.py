"""The series' promises (v1.5): its tapestry by book, the story so far, and setups that pay
off in another book. The books are read together once per request (services/series/promises.py).
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.series import SeriesSceneLink
from ..models.user import User
from ..schemas.promises import BookScene
from ..schemas.series_promises import (
    BookSoFar,
    SceneLinkCreate,
    SceneLinkUpdate,
    SeriesLinkOut,
    SeriesPromisesOut,
)
from ..services import change_log
from ..services.promises import promise_facts
from ..services.series import service, setups
from ..services.series.promises import SeriesPromises
from ..services.series.views import series_view, story_so_far
from .series import _said, _series

router = APIRouter()


def _read(series_id: str, db: Session, user: User) -> SeriesPromises:
    series = _series(series_id, db, user)
    service.tidy(db, series)
    db.commit()
    return SeriesPromises(db, series)


@router.get("/series/{series_id}/promises", response_model=SeriesPromisesOut)
def series_promises(series_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every thread and twist the series shares, what each book does with it, and its setups across books."""
    return series_view(_read(series_id, db, current_user))


@router.get("/series/{series_id}/story-so-far", response_model=list[BookSoFar])
def series_story_so_far(series_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A card per book: what it leaves the reader with, a reminder before the next."""
    return story_so_far(db, _read(series_id, db, current_user))


def _out(db: Session, link: SeriesSceneLink) -> SeriesLinkOut:
    pos = service.positions(link.series)

    def scene(story_id: str, node_id: str) -> BookScene:
        facts = promise_facts(story_id, db)
        return BookScene(position=pos[story_id], story_id=story_id, node_id=node_id, title=facts.title(node_id))

    return SeriesLinkOut(
        id=link.id,
        link_type=link.link_type,
        note=link.note or "",
        source=scene(link.source_story_id, link.source_node_id),
        target=scene(link.target_story_id, link.target_node_id),
    )


@router.post("/series/{series_id}/scene-links", response_model=SeriesLinkOut, status_code=status.HTTP_201_CREATED)
def add_scene_link(
    series_id: str,
    body: SceneLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """A scene of this book set up by, or paying off, a scene of another. Undoable in this book."""
    series = _series(series_id, db, current_user)
    with _said(db):
        link = setups.add_link(
            db,
            series,
            (body.story_id, body.node_id),
            (body.other_story_id, body.other_node_id),
            link_type=body.link_type,
            note=body.note,
            made_in=body.story_id,
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()
    return _out(db, link)


@router.patch("/series/{series_id}/scene-links/{link_id}", response_model=SeriesLinkOut)
def update_scene_link(
    series_id: str,
    link_id: str,
    body: SceneLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    series = _series(series_id, db, current_user)
    with _said(db):
        link = setups.update_link(
            db,
            series,
            link_id,
            body.model_dump(exclude_none=True),
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()
    return _out(db, link)


@router.delete("/series/{series_id}/scene-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_scene_link(
    series_id: str,
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    series = _series(series_id, db, current_user)
    with _said(db):
        setups.remove_link(db, series, link_id, actor_id=current_user.id, client_id=client_id)
    db.commit()
