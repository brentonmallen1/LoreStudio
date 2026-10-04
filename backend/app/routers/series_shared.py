"""Research a series shares (v1.5): kept in step in every book, each holding its own copy.

Sharing puts a copy in every book, each logged in its book. An edit to any copy is made to
every other (services/series/sync.py); here the series page sees which books hold it and
whether they agree, and makes one book's copy every book's when they do not.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.series import ElementLift, SeriesOut, SharedOut, SyncFrom
from ..services import change_log
from ..services.series import service, sync
from ..services.series.kinds import SYNCED_KINDS
from .series import _element, _members, _said, _series, _tidied

router = APIRouter()


@router.post("/series/{series_id}/share", response_model=SeriesOut)
def share(
    series_id: str,
    body: ElementLift,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """A book's research entry, image or diagram, shared with every book of the series."""
    series = _series(series_id, db, current_user)
    with _said(db):
        sync.share(db, series, body.kind, body.story_id, body.ref_id, actor_id=current_user.id, client_id=client_id)
    return _tidied(series, db)


@router.get("/series/{series_id}/shared", response_model=list[SharedOut])
def shared(series_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """What the series shares as research, the books that hold it, and whether they agree."""
    series = _series(series_id, db, current_user)
    service.tidy(db, series)
    db.commit()
    pos = service.positions(series)
    out = [
        SharedOut(
            element_id=e.id,
            kind=e.kind,
            name=e.name,
            members=_members(e, pos),
            in_step=sync.in_step(db, e),
            missing=[sid for sid in pos if service.member_in(e, sid) is None],
        )
        for e in series.elements
        if e.kind in SYNCED_KINDS
    ]
    return sorted(out, key=lambda x: (SYNCED_KINDS.index(x.kind), x.name.lower()))


@router.post("/series/{series_id}/elements/{element_id}/sync", response_model=SeriesOut)
def sync_from(
    series_id: str,
    element_id: str,
    body: SyncFrom,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """One book's copy made every book's, when they have come apart. Each book logs its own."""
    series = _series(series_id, db, current_user)
    element = _element(series, element_id)
    sync.push(db, element, body.source_story_id, actor_id=current_user.id, client_id=client_id)
    return _tidied(series, db)
