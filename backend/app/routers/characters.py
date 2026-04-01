import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character, CharacterRelationship
from ..schemas.character import (
    CharacterCreate, CharacterUpdate, CharacterOut,
    RelationshipCreate, RelationshipOut,
    ArcMilestone,
)
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider
from ..services.llm.prompts import build_attribute_generation_prompt

router = APIRouter()


def _verify_character_access(character_id: str, db: Session, user: User) -> Character:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    story = db.query(Story).filter(Story.id == character.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.get("/{character_id}", response_model=CharacterOut)
def get_character(character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_character_access(character_id, db, current_user)


@router.patch("/{character_id}", response_model=CharacterOut)
def update_character(
    character_id: str,
    body: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    character = _verify_character_access(character_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(character, key, value)
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    character = _verify_character_access(character_id, db, current_user)
    db.delete(character)
    db.commit()


@router.get("/{character_id}/relationships", response_model=list[RelationshipOut])
def list_relationships(
    character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _verify_character_access(character_id, db, current_user)
    return db.query(CharacterRelationship).filter(CharacterRelationship.character_id == character_id).all()


@router.post("/{character_id}/relationships", response_model=RelationshipOut, status_code=status.HTTP_201_CREATED)
def create_relationship(
    character_id: str,
    body: RelationshipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_character_access(character_id, db, current_user)
    if character_id == body.related_character_id:
        raise HTTPException(status_code=400, detail="Cannot relate character to itself")
    rel = CharacterRelationship(character_id=character_id, **body.model_dump())
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.post("/{character_id}/generate-attributes")
async def generate_attributes(
    character_id: str,
    attribute_type: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream AI-generated attribute suggestions for a character."""
    character = _verify_character_access(character_id, db, current_user)
    system_prompt = build_attribute_generation_prompt(character, attribute_type)
    llm_messages = [{"role": "user", "content": "Please provide your suggestions."}]

    async def stream():
        async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


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


@router.delete("/relationships/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_relationship(
    relationship_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rel = db.get(CharacterRelationship, relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    _verify_character_access(rel.character_id, db, current_user)
    db.delete(rel)
    db.commit()
