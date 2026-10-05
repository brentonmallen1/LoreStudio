"""A series planned from the start (series v2): books before they are written, each book's
part, the arc across the books, and what changes from book to book.

The series' own shape (its arc, its axes, which books it holds) is not undoable, as in v1;
a book's own part of the plan is, in that book.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.series import (
    ArcSet,
    AxesSet,
    BookCarry,
    BookPlanUpdate,
    PlannedBookCreate,
    PlannedBookOut,
    SeriesOut,
    SeriesShapeOut,
    ShapeApply,
)
from ..services import change_log
from ..services.series import plan, service, templates
from .series import _said, _series, _story, _tidied

router = APIRouter()


@router.post("/series/{series_id}/books", response_model=PlannedBookOut, status_code=status.HTTP_201_CREATED)
def add_planned_book(
    series_id: str,
    body: PlannedBookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A book planned before it is written: a story with no words yet, in its place."""
    series = _series(series_id, db, current_user)
    with _said(db):
        book = plan.add_planned_book(db, series, body.title, position=body.position, role=body.role)
    story_id = book.story_id
    return PlannedBookOut(series=_tidied(series, db), story_id=story_id)


@router.put("/series/{series_id}/arc", response_model=SeriesOut)
def set_arc(
    series_id: str,
    body: ArcSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The arc across the books, in order: its beats, each placed on the books that carry it."""
    series = _series(series_id, db, current_user)
    with _said(db):
        plan.set_arc(series, [b.model_dump() for b in body.arc])
    return _tidied(series, db)


@router.put("/series/{series_id}/axes", response_model=SeriesOut)
def set_axes(
    series_id: str,
    body: AxesSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What changes from book to book: a viewpoint character, an era, a place, or words."""
    series = _series(series_id, db, current_user)
    with _said(db):
        plan.set_axes(series, [a.model_dump() for a in body.axes])
    return _tidied(series, db)


@router.patch("/series/{series_id}/books/{story_id}", response_model=SeriesOut)
def update_book(
    series_id: str,
    story_id: str,
    body: BookPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """A book's own part of the plan; undoable in that book."""
    series = _series(series_id, db, current_user)
    with _said(db):
        plan.update_book(
            db,
            series,
            story_id,
            body.model_dump(exclude_none=True),
            actor_id=current_user.id,
            client_id=client_id,
        )
    return _tidied(series, db)


@router.post("/series/{series_id}/books/{story_id}/carry", response_model=SeriesOut)
def carry_into_book(
    series_id: str,
    story_id: str,
    body: BookCarry,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Bring characters, places and promises into a book already in the series: a planned
    book given its cast once the book before it has one. One undo in that book."""
    series = _series(series_id, db, current_user)
    source = _story(body.source_story_id, db, current_user)
    with _said(db):
        plan.book_of(series, story_id)
        plan.book_of(series, source.id)
        service.carry_into(
            db,
            series,
            source,
            story_id,
            [c.model_dump() for c in body.carry],
            actor_id=current_user.id,
            client_id=client_id,
        )
    return _tidied(series, db)


# ── Shapes ───────────────────────────────────────────────────────────────────────


@router.get("/series-shapes", response_model=list[SeriesShapeOut])
def list_shapes(current_user: User = Depends(get_current_user)):
    """Ready-made starts for a series' plan: a duology, a trilogy, a saga, a viewpoint each
    book, a generational saga."""
    return [
        SeriesShapeOut(
            id=s.id,
            name=s.name,
            summary=s.summary,
            roles=list(s.roles),
            beats=[name for name, _, _ in s.arc],
            axes=[{"kind": k, "label": label, "pov": pov} for k, label, pov in s.axes],
        )
        for s in templates.SHAPES
    ]


@router.post("/series/{series_id}/shape", response_model=SeriesOut)
def apply_shape(
    series_id: str,
    body: ShapeApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the plan from a shape: planned books up to its count, its arc placed on them, the
    axes it is missing and a part for each book with none. Changes nothing already written."""
    series = _series(series_id, db, current_user)
    with _said(db):
        templates.apply(db, series, body.shape_id)
    return _tidied(series, db)
