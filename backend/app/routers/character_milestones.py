"""Character arc milestones (split from characters.py to keep that file inside its size budget)."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.character import ArcMilestone, CharacterOut
from .characters import _verify_character_access

router = APIRouter()


@router.post("/{character_id}/milestones", response_model=CharacterOut)
def add_milestone(
    character_id: str,
    body: ArcMilestone,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    character = _verify_character_access(character_id, db, current_user)
    milestones = list(character.arc_milestones or [])
    milestones.append({"id": str(uuid.uuid4()), "text": body.text, "completed": False})
    character.arc_milestones = milestones
    db.commit()
    db.refresh(character)
    return character


@router.patch("/{character_id}/milestones/{milestone_id}", response_model=CharacterOut)
def update_milestone(
    character_id: str,
    milestone_id: str,
    body: ArcMilestone,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    character = _verify_character_access(character_id, db, current_user)
    milestones = list(character.arc_milestones or [])
    for m in milestones:
        if m["id"] == milestone_id:
            if body.text:
                m["text"] = body.text
            m["completed"] = body.completed
            if body.scene_id is not None:
                m["scene_id"] = body.scene_id
            if body.scene_title is not None:
                m["scene_title"] = body.scene_title
    character.arc_milestones = milestones
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}/milestones/{milestone_id}", response_model=CharacterOut)
def delete_milestone(
    character_id: str,
    milestone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    character = _verify_character_access(character_id, db, current_user)
    character.arc_milestones = [m for m in (character.arc_milestones or []) if m["id"] != milestone_id]
    db.commit()
    db.refresh(character)
    return character
