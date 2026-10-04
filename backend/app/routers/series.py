"""Series: books in order, and the elements they share (series doc).

Every series endpoint tidies first (members whose row was deleted, element names that
moved on), so what it returns is current. Adding an element to a book is undoable in that
book; the series' own shape (its name, its order, what is shared) is not, because undo is
per book.
"""

from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.series import Series, SeriesElement
from ..models.story import Story
from ..models.structure import StoryStructureTemplate
from ..models.user import User
from ..schemas.series import (
    BookJoin,
    BooksOrder,
    CarryCandidate,
    ElementDetailOut,
    ElementFieldOut,
    ElementLift,
    FieldValueOut,
    MemberAdd,
    SequelCreate,
    SeriesBookOut,
    SeriesCreate,
    SeriesElementOut,
    SeriesMemberOut,
    SeriesOut,
    SeriesSummary,
    SeriesUpdate,
    StorySeriesOut,
)
from ..schemas.story import StoryCreated
from ..services import change_log
from ..services.series import service
from ..services.series.drift import disagree
from ..services.series.kinds import FRONTEND_KIND, SERIES_KINDS, field_class
from ..services.structure_scaffold import scaffold_story

router = APIRouter()

_KIND_ORDER = {k: i for i, k in enumerate(SERIES_KINDS)}


@contextmanager
def _said(db: Session):
    """SeriesError -> the HTTP error it names, with nothing half-made left behind."""
    try:
        yield
    except service.SeriesError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e


def _series(series_id: str, db: Session, user: User) -> Series:
    series = db.query(Series).filter(Series.id == series_id, Series.user_id == user.id).first()
    if series is None:
        raise HTTPException(status_code=404, detail="Series not found")
    return series


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _element(series: Series, element_id: str) -> SeriesElement:
    element = next((e for e in series.elements if e.id == element_id), None)
    if element is None:
        raise HTTPException(status_code=404, detail="Series element not found")
    return element


def _books(series: Series) -> list[SeriesBookOut]:
    return [
        SeriesBookOut(story_id=b.story_id, title=b.story.title, position=i, updated_at=b.story.updated_at)
        for i, b in enumerate(sorted(series.books, key=lambda b: b.position))
    ]


def _members(element: SeriesElement, pos: dict[str, int]) -> list[SeriesMemberOut]:
    members = [
        SeriesMemberOut(story_id=m.story_id, ref_id=m.ref_id, position=pos[m.story_id])
        for m in element.members
        if m.story_id in pos
    ]
    return sorted(members, key=lambda m: m.position)


def serialize(series: Series) -> SeriesOut:
    pos = service.positions(series)
    elements = [
        SeriesElementOut(
            id=e.id,
            kind=e.kind,
            lore_kind=FRONTEND_KIND.get(e.kind, e.kind),
            name=e.name,
            members=_members(e, pos),
        )
        for e in series.elements
    ]
    elements.sort(key=lambda e: (_KIND_ORDER.get(e.kind, 99), e.name.lower()))
    return SeriesOut(
        id=series.id,
        name=series.name,
        premise=series.premise or "",
        intent=series.intent or "",
        field_classes=series.field_classes or {},
        books=_books(series),
        elements=elements,
    )


def _tidied(series: Series, db: Session) -> SeriesOut:
    service.tidy(db, series)
    db.commit()
    db.refresh(series)
    return serialize(series)


# ── The series ───────────────────────────────────────────────────────────────────


@router.get("/series", response_model=list[SeriesSummary])
def list_series(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Series).filter(Series.user_id == current_user.id).order_by(Series.name).all()
    return [SeriesSummary(id=s.id, name=s.name, books=_books(s)) for s in rows]


@router.post("/series", response_model=SeriesOut, status_code=status.HTTP_201_CREATED)
def create_series(body: SeriesCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stories = [_story(sid, db, current_user) for sid in body.story_ids]
    with _said(db):
        series = service.create_series(db, current_user.id, body.name, premise=body.premise, intent=body.intent)
        for story in stories:
            service.attach_story(db, series, story)
    db.commit()
    db.refresh(series)
    return serialize(series)


@router.get("/series/{series_id}", response_model=SeriesOut)
def get_series(series_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _tidied(_series(series_id, db, current_user), db)


@router.patch("/series/{series_id}", response_model=SeriesOut)
def update_series(
    series_id: str,
    body: SeriesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    series = _series(series_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "name" in data and not data["name"].strip():
        raise HTTPException(status_code=400, detail="A series needs a name.")
    for key, value in data.items():
        setattr(series, key, value.strip() if key == "name" else value)
    return _tidied(series, db)


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_series(series_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The series goes; every book stays, with its own rows."""
    db.delete(_series(series_id, db, current_user))
    db.commit()


@router.get("/stories/{story_id}/series", response_model=StorySeriesOut)
def story_series(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _story(story_id, db, current_user)
    book = service.membership(db, story_id)
    if book is None:
        return StorySeriesOut(series=None)
    out = _tidied(book.series, db)
    return StorySeriesOut(series=out, position=service.positions(book.series)[story_id])


# ── Books ────────────────────────────────────────────────────────────────────────


@router.put("/series/{series_id}/stories", response_model=SeriesOut)
def reorder_books(
    series_id: str,
    body: BooksOrder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    series = _series(series_id, db, current_user)
    with _said(db):
        service.reorder(db, series, body.story_ids)
    return _tidied(series, db)


@router.post("/series/{series_id}/stories", response_model=SeriesOut)
def join_series(
    series_id: str,
    body: BookJoin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    series = _series(series_id, db, current_user)
    story = _story(body.story_id, db, current_user)
    with _said(db):
        service.attach_story(db, series, story, body.position)
    return _tidied(series, db)


@router.delete("/series/{series_id}/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def leave_series(
    series_id: str, story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """The book leaves; its characters and places stay in it, now its own."""
    series = _series(series_id, db, current_user)
    if story_id not in service.positions(series):
        raise HTTPException(status_code=404, detail="That book is not in this series.")
    service.detach_story(db, story_id)
    db.commit()


# ── Elements ─────────────────────────────────────────────────────────────────────


@router.post("/series/{series_id}/elements", response_model=SeriesOut)
def lift_element(
    series_id: str,
    body: ElementLift,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    series = _series(series_id, db, current_user)
    with _said(db):
        service.lift_element(db, series, body.kind, body.story_id, body.ref_id)
    return _tidied(series, db)


@router.delete("/series/{series_id}/elements/{element_id}", response_model=SeriesOut)
def unlift_element(
    series_id: str, element_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """No longer shared: every book keeps its own row."""
    series = _series(series_id, db, current_user)
    service.unlift(db, series, _element(series, element_id))
    return _tidied(series, db)


@router.get("/series/{series_id}/elements/{element_id}", response_model=ElementDetailOut)
def element_detail(
    series_id: str, element_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Every field of the element in every book that has it, in series order."""
    series = _series(series_id, db, current_user)
    service.tidy(db, series)
    db.commit()
    element = _element(series, element_id)
    kind = SERIES_KINDS[element.kind]
    pos = service.positions(series)
    rows = [
        (m, row)
        for m in sorted(element.members, key=lambda m: pos.get(m.story_id, 0))
        if (row := service.member_row(db, m)) is not None
    ]
    fields = []
    for key in kind.fields:
        cls = field_class(kind, key, series.field_classes)
        values = [
            FieldValueOut(story_id=m.story_id, position=pos[m.story_id], value=str(getattr(row, key) or ""))
            for m, row in rows
        ]
        differs = cls == "enduring" and disagree(v.value for v in values)
        fields.append(ElementFieldOut(key=key, field_class=cls, values=values, differs=differs))
    out = serialize(series)
    return ElementDetailOut(element=next(e for e in out.elements if e.id == element.id), fields=fields)


@router.post("/series/{series_id}/elements/{element_id}/members", response_model=SeriesOut)
def add_member(
    series_id: str,
    element_id: str,
    body: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Bring the element into a book (a copy of where it last stood), or link a row it already has."""
    series = _series(series_id, db, current_user)
    service.tidy(db, series)
    element = _element(series, element_id)
    with _said(db):
        if body.ref_id:
            service.link_existing(db, series, element, body.story_id, body.ref_id)
        else:
            service.adopt_into_book(db, series, element, body.story_id, actor_id=current_user.id, client_id=client_id)
    return _tidied(series, db)


@router.delete("/series/{series_id}/elements/{element_id}/members/{story_id}", response_model=SeriesOut)
def remove_member(
    series_id: str,
    element_id: str,
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """This book's row stops being the series element; it stays in the book as its own."""
    series = _series(series_id, db, current_user)
    element = _element(series, element_id)
    member = service.member_in(element, story_id)
    if member is None:
        raise HTTPException(status_code=404, detail=f"{element.name} is not in that book.")
    # Undo puts the link back, which needs the element: only while another book still has it.
    change_log.record(
        db,
        story_id=story_id,
        entity_type="series_element_member",
        entity_id=member.id,
        action="delete",
        before={"series_element_members": [change_log._row(member)]},
        after=None,
        label=f"Take {element.name} out of the series in this book",
        actor_id=current_user.id,
        client_id=client_id,
        undoable=len(element.members) > 1,
    )
    with _said(db):
        service.unlink_member(db, series, element, story_id)
    return _tidied(series, db)


# ── The next book ────────────────────────────────────────────────────────────────


class SequelCreated(StoryCreated):
    series_id: str


@router.get("/stories/{story_id}/carry-over", response_model=list[CarryCandidate])
def carry_over(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """What a sequel to this book could start with, each kind in the Lorebook's order."""
    story = _story(story_id, db, current_user)
    book = service.membership(db, story_id)
    if book is not None:
        service.tidy(db, book.series)
        db.commit()
    return [
        CarryCandidate(**c, lore_kind=FRONTEND_KIND.get(c["kind"], c["kind"]))
        for c in service.carry_candidates(db, story)
    ]


@router.post("/stories/{story_id}/sequel", response_model=SequelCreated, status_code=status.HTTP_201_CREATED)
def write_sequel(
    story_id: str,
    body: SequelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A new book after this one, in its series (made now if there is none), starting with
    the characters, places and world the author chose to carry over."""
    source = _story(story_id, db, current_user)
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="A book needs a title.")
    book = service.membership(db, story_id)
    if book is not None:
        service.tidy(db, book.series)
    story = Story(user_id=current_user.id, title=body.title.strip(), description=body.description)
    db.add(story)
    db.flush()
    with _said(db):
        series = service.start_next_book(
            db,
            source,
            story,
            [c.model_dump() for c in body.carry],
            series_name=body.series_name,
        )
    if body.structure_template_id:
        story.structure_template_id = body.structure_template_id
    start = None
    if body.scaffold:
        start = scaffold_story(story.id, db.get(StoryStructureTemplate, story.structure_template_id), db)
    db.commit()
    db.refresh(story)
    created = StoryCreated.model_validate(story)
    return SequelCreated(**created.model_dump(), series_id=series.id).model_copy(
        update={"start_node_id": start.id if start else None}
    )
