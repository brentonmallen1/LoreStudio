from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character, CharacterRelationship
from ..schemas.character import CharacterCreate, CharacterUpdate, CharacterOut, RelationshipCreate, RelationshipOut
from ..auth.dependencies import get_current_user

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
