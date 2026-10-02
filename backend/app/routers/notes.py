"""Notes (doc 15): margin notes, questions, to-dos and ideas, one row each.

Every write goes through the change log, so a note, its answer or its tick can be undone.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.note import Note
from ..models.story import Story
from ..models.user import User
from ..schemas.note import AboutType, NoteCreate, NoteKind, NoteOut, NoteUpdate, ReorderPayload
from ..services import change_log

router = APIRouter()

NOUNS = {"note": "note", "question": "question", "todo": "to-do", "idea": "idea"}


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_note(note_id: str, db: Session, user: User) -> Note:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    _verify_story(note.story_id, db, user)
    return note


def _label(verb: str, note: Note) -> str:
    return f"{verb} {NOUNS.get(note.kind, 'note')} “{(note.content or '')[:40]}”"


def _serialize(note: Note) -> NoteOut:
    out = NoteOut.model_validate(note)
    out.answer = note.answer or ""
    out.node_title = note.node.title if note.node else None
    return out


@router.get("/stories/{story_id}/notes", response_model=list[NoteOut])
def list_notes(
    story_id: str,
    kind: list[NoteKind] | None = Query(None),
    node_id: str | None = None,
    about_type: AboutType | None = None,
    about_id: str | None = None,
    open: bool | None = None,  # noqa: A002 (the query parameter's name)
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    q = db.query(Note).filter(Note.story_id == story_id)
    if kind:
        q = q.filter(Note.kind.in_(kind))
    if node_id:
        q = q.filter(Note.node_id == node_id)
    if about_type and about_id:
        q = q.filter(Note.about_type == about_type, Note.about_id == about_id)
    if open is not None:
        q = q.filter(Note.done == (not open))
    return [_serialize(n) for n in q.order_by(Note.position.asc(), Note.created_at.asc()).all()]


@router.post("/stories/{story_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    story_id: str,
    body: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    if body.id and db.get(Note, body.id):
        raise HTTPException(status_code=409, detail="A note with that id exists")
    last = db.query(Note.position).filter(Note.story_id == story_id).order_by(Note.position.desc()).first()
    data = body.model_dump(exclude_none=True)
    note = Note(story_id=story_id, position=(last[0] + 1) if last else 0, **data)
    db.add(note)
    db.flush()
    change_log.record_row_create(
        db,
        note,
        "notes",
        entity_type="note",
        story_id=story_id,
        label=_label("Add", note),
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(note)
    return _serialize(note)


@router.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _serialize(_verify_note(note_id, db, current_user))


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: str,
    body: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    note = _verify_note(note_id, db, current_user)
    # Untying is a real change: a field the client sends as null is cleared.
    data = body.model_dump(exclude_unset=True)
    for key in ("content", "kind", "answer", "done", "position"):
        if data.get(key, "") is None:
            data.pop(key)
    change_log.record_update(
        db,
        note,
        data,
        entity_type="note",
        story_id=note.story_id,
        label=_label("Edit", note),
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return _serialize(note)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    note = _verify_note(note_id, db, current_user)
    change_log.record_row_delete(
        db,
        note,
        "notes",
        entity_type="note",
        story_id=note.story_id,
        label=_label("Delete", note),
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(note)
    db.commit()


@router.post("/stories/{story_id}/notes/reorder", response_model=list[NoteOut])
def reorder_notes(
    story_id: str,
    body: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    before = change_log.reorder_snapshot(Note, list(body.note_ids), db)
    for idx, note_id in enumerate(body.note_ids):
        note = db.get(Note, note_id)
        if note and note.story_id == story_id:
            note.position = idx
    db.flush()
    after = change_log.reorder_snapshot(Note, list(body.note_ids), db)
    if before != after:
        change_log.record(
            db,
            story_id=story_id,
            entity_type="note",
            entity_id=story_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder notes",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()
    rows = db.query(Note).filter(Note.story_id == story_id).order_by(Note.position.asc(), Note.created_at.asc())
    return [_serialize(n) for n in rows.all()]


@router.delete("/stories/{story_id}/notes/done", status_code=status.HTTP_204_NO_CONTENT)
def delete_done_todos(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Clear ticked to-dos. Answered questions keep their answers, so they stay."""
    _verify_story(story_id, db, current_user)
    done = db.query(Note).filter(Note.story_id == story_id, Note.kind == "todo", Note.done == True).all()  # noqa: E712
    for note in done:
        change_log.record_row_delete(
            db,
            note,
            "notes",
            entity_type="note",
            story_id=story_id,
            label=_label("Clear", note),
            actor_id=current_user.id,
            client_id=client_id,
        )
        db.delete(note)
    db.commit()
