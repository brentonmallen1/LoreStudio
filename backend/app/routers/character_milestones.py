"""A character's arc milestones and discovery notes: lists kept on the character row (split from
characters.py to keep that file inside its size budget). Every edit is one undoable change."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.user import User
from ..schemas.character import ArcMilestone, CharacterOut, DiscoveryNoteCreate, DiscoveryNoteUpdate
from ..services import change_log
from .characters import _verify_character_access

router = APIRouter()


def _copy(character: Character, field: str) -> list[dict]:
    """The list as fresh dicts: editing the loaded JSON in place would leave nothing to diff."""
    return [dict(item) for item in (getattr(character, field) or [])]


def _save(
    db: Session, character: Character, field: str, items: list[dict], label: str, user: User, client_id: str | None
) -> Character:
    change_log.record_update(
        db,
        character,
        {field: items},
        entity_type="character",
        story_id=character.story_id,
        label=label,
        actor_id=user.id,
        client_id=client_id,
    )
    setattr(character, field, items)
    flag_modified(character, field)
    db.commit()
    db.refresh(character)
    return character


# ── Arc milestones ───────────────────────────────────────────────────────────────


@router.post("/{character_id}/milestones", response_model=CharacterOut)
def add_milestone(
    character_id: str,
    body: ArcMilestone,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    milestones = _copy(character, "arc_milestones")
    milestones.append({"id": str(uuid.uuid4()), "text": body.text, "completed": False})
    label = f"Add milestone to {character.name}"
    return _save(db, character, "arc_milestones", milestones, label, current_user, client_id)


@router.patch("/{character_id}/milestones/{milestone_id}", response_model=CharacterOut)
def update_milestone(
    character_id: str,
    milestone_id: str,
    body: ArcMilestone,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    milestones = _copy(character, "arc_milestones")
    for m in milestones:
        if m["id"] == milestone_id:
            if body.text:
                m["text"] = body.text
            m["completed"] = body.completed
            if body.scene_id is not None:
                m["scene_id"] = body.scene_id
            if body.scene_title is not None:
                m["scene_title"] = body.scene_title
    label = f"Edit milestone on {character.name}"
    return _save(db, character, "arc_milestones", milestones, label, current_user, client_id)


@router.delete("/{character_id}/milestones/{milestone_id}", response_model=CharacterOut)
def delete_milestone(
    character_id: str,
    milestone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    milestones = [m for m in _copy(character, "arc_milestones") if m["id"] != milestone_id]
    label = f"Delete milestone from {character.name}"
    return _save(db, character, "arc_milestones", milestones, label, current_user, client_id)


# ── Discovery notes ──────────────────────────────────────────────────────────────


@router.post("/{character_id}/discovery-notes", response_model=CharacterOut)
def add_discovery_note(
    character_id: str,
    body: DiscoveryNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Add a discovery note with optional scene link."""
    character = _verify_character_access(character_id, db, current_user)
    notes = _copy(character, "discovery_notes")
    notes.append(
        {
            "id": str(uuid.uuid4()),
            "text": body.text,
            "scene_id": body.scene_id,
            "scene_title": body.scene_title,
            "timestamp": datetime.now(UTC).isoformat(),
            "confirmed": False,
        }
    )
    label = f"Add discovery note to {character.name}"
    return _save(db, character, "discovery_notes", notes, label, current_user, client_id)


@router.patch("/{character_id}/discovery-notes/{note_id}", response_model=CharacterOut)
def update_discovery_note(
    character_id: str,
    note_id: str,
    body: DiscoveryNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Confirm or edit a discovery note."""
    character = _verify_character_access(character_id, db, current_user)
    notes = _copy(character, "discovery_notes")
    for note in notes:
        if note["id"] == note_id:
            for key, value in body.model_dump(exclude_none=True).items():
                note[key] = value
            break
    verb = "Confirm" if body.confirmed else "Edit"
    label = f"{verb} discovery note on {character.name}"
    return _save(db, character, "discovery_notes", notes, label, current_user, client_id)


@router.delete("/{character_id}/discovery-notes/{note_id}", response_model=CharacterOut)
def delete_discovery_note(
    character_id: str,
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Remove a discovery note."""
    character = _verify_character_access(character_id, db, current_user)
    notes = [n for n in _copy(character, "discovery_notes") if n["id"] != note_id]
    label = f"Delete discovery note from {character.name}"
    return _save(db, character, "discovery_notes", notes, label, current_user, client_id)
