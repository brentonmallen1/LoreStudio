"""Character relationships (split from characters.py to keep that file inside its size budget)."""

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import CharacterRelationship
from ..models.user import User
from ..schemas.character import RelationshipCreate, RelationshipOut, RelationshipTemplate, RelationshipUpdate
from ..services import change_log
from ..services.relationship_templates import get_all_templates, get_template
from .characters import _verify_character_access

router = APIRouter()


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
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    if character_id == body.related_character_id:
        raise HTTPException(status_code=400, detail="Cannot relate character to itself")
    existing = (
        db.query(CharacterRelationship)
        .filter(
            CharacterRelationship.character_id == character_id,
            CharacterRelationship.related_character_id == body.related_character_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A relationship from this character to the selected character already exists (id: {existing.id}). Edit the existing relationship instead.",
        )
    data = body.model_dump()
    if isinstance(data.get("strength"), dict):
        pass
    elif hasattr(data.get("strength"), "model_dump"):
        data["strength"] = data["strength"].model_dump()
    rel = CharacterRelationship(character_id=character_id, **data)
    db.add(rel)
    db.flush()
    change_log.record_row_create(
        db,
        rel,
        "character_relationships",
        entity_type="character_relationship",
        story_id=character.story_id,
        label=f"Add relationship from {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(rel)
    return rel


@router.get("/relationships/templates", response_model=list[RelationshipTemplate])
def list_relationship_templates(current_user: User = Depends(get_current_user)):
    return get_all_templates()


@router.patch("/relationships/{relationship_id}", response_model=RelationshipOut)
def update_relationship(
    relationship_id: str,
    body: RelationshipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    rel = db.get(CharacterRelationship, relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    character = _verify_character_access(rel.character_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "strength" in data and hasattr(data["strength"], "model_dump"):
        data["strength"] = data["strength"].model_dump()
    change_log.record_update(
        db,
        rel,
        data,
        entity_type="character_relationship",
        story_id=character.story_id,
        label=f"Edit relationship {{fields}} on {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(rel, key, value)
    db.commit()
    db.refresh(rel)
    return rel


@router.post(
    "/{character_id}/relationships/from-template", response_model=RelationshipOut, status_code=status.HTTP_201_CREATED
)
def create_relationship_from_template(
    character_id: str,
    related_character_id: str = Body(...),
    template_id: str = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    if character_id == related_character_id:
        raise HTTPException(status_code=400, detail="Cannot relate character to itself")
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    rel = CharacterRelationship(
        character_id=character_id,
        related_character_id=related_character_id,
        relationship_type=template.relationship_type,
        description="",
        strength=template.default_strength.model_dump(),
        visibility=template.default_visibility,
        narrative_purpose=template.default_narrative_purpose,
        notes="",
        is_suggested=False,
        suggestion_source="",
    )
    db.add(rel)
    db.flush()
    change_log.record_row_create(
        db,
        rel,
        "character_relationships",
        entity_type="character_relationship",
        story_id=character.story_id,
        label=f"Add relationship from {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(rel)
    return rel


@router.post("/relationships/{relationship_id}/accept-suggestion", response_model=RelationshipOut)
def accept_relationship_suggestion(
    relationship_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    rel = db.get(CharacterRelationship, relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    character = _verify_character_access(rel.character_id, db, current_user)
    data = {"is_suggested": False, "suggestion_source": ""}
    change_log.record_update(
        db,
        rel,
        data,
        entity_type="character_relationship",
        story_id=character.story_id,
        label=f"Accept suggested relationship from {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(rel, key, value)
    db.commit()
    db.refresh(rel)
    return rel


@router.delete("/relationships/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_relationship(
    relationship_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    rel = db.get(CharacterRelationship, relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    character = _verify_character_access(rel.character_id, db, current_user)
    change_log.record_row_delete(
        db,
        rel,
        "character_relationships",
        entity_type="character_relationship",
        story_id=character.story_id,
        label=f"Delete relationship from {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(rel)
    db.commit()
