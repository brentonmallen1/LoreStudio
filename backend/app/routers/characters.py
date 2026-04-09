import uuid
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character, CharacterRelationship
from ..models.structure import StructureNode
from ..models.dialogue import DialogueBlock
from ..schemas.character import (
    CharacterCreate, CharacterUpdate, CharacterOut,
    RelationshipCreate, RelationshipOut,
    ArcMilestone,
)
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext, AICallResult
from ..services.llm.prompts.generation import build_attribute_generation_prompt
from ..schemas.ai_responses import AttributeSuggestionsResponse, StructuredResult
from ..services.character_journey import (
    get_cached_journey, get_nodes_up_to, get_scenes_with_character,
    build_journey_prompt, save_journey,
)

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


@router.post("/{character_id}/generate-attributes", response_model=StructuredResult)
async def generate_attributes(
    character_id: str,
    attribute_type: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate structured AI attribute suggestions for a character."""
    character = _verify_character_access(character_id, db, current_user)
    feature_prompt = build_attribute_generation_prompt(character, attribute_type)
    llm_messages = [{"role": "user", "content": "Please provide your suggestions."}]

    ctx = AICallContext(
        feature="character-attributes",
        user_id=current_user.id,
        story_id=character.story_id,
        character_id=character_id,
        tags=["character", "generation", "lorebook", "user-initiated"],
        extra_metadata={"attribute_type": attribute_type},
    )

    return await ai_gateway.generate_structured(
        response_model=AttributeSuggestionsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


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


class DialogueBlockWithScene(BaseModel):
    id: str
    scene_id: str
    scene_title: str
    character_id: str | None
    speaker_name: str
    content: str
    attribution_method: str
    confidence: float
    paragraph_index: int

    model_config = {"from_attributes": True}


@router.get("/{character_id}/dialogue", response_model=list[DialogueBlockWithScene])
def get_character_dialogue(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all dialogue blocks for a character across all scenes, ordered by story position."""
    _verify_character_access(character_id, db, current_user)
    rows = (
        db.query(DialogueBlock, StructureNode.title, StructureNode.position)
        .join(StructureNode, DialogueBlock.scene_id == StructureNode.id)
        .filter(DialogueBlock.character_id == character_id)
        .order_by(StructureNode.position, DialogueBlock.paragraph_index, DialogueBlock.position_in_paragraph)
        .all()
    )
    result = []
    for block, scene_title, _ in rows:
        result.append(DialogueBlockWithScene(
            id=block.id,
            scene_id=block.scene_id,
            scene_title=scene_title or "Untitled",
            character_id=block.character_id,
            speaker_name=block.speaker_name,
            content=block.content,
            attribution_method=block.attribution_method,
            confidence=block.confidence,
            paragraph_index=block.paragraph_index,
        ))
    return result


@router.get("/{character_id}/journey")
def get_character_journey(
    character_id: str,
    up_to_node: str = Query(..., description="Node ID to use as the 'current point in story'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a cached character journey summary up to the given node.
    If no cache exists yet, returns empty summary with scene_count.
    """
    character = _verify_character_access(character_id, db, current_user)
    node = db.get(StructureNode, up_to_node)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    cached = get_cached_journey(character_id, up_to_node, db)
    nodes_up_to = get_nodes_up_to(node.story_id, up_to_node, db)
    relevant_scenes = get_scenes_with_character(nodes_up_to, character)

    if cached:
        return {
            "summary": cached.summary,
            "is_stale": cached.is_stale,
            "scene_count": len(relevant_scenes),
            "generated_at": cached.updated_at.replace(tzinfo=timezone.utc).isoformat(),
        }
    return {
        "summary": "",
        "is_stale": False,
        "scene_count": len(relevant_scenes),
        "generated_at": None,
    }


@router.post("/{character_id}/journey/refresh")
async def refresh_character_journey(
    character_id: str,
    up_to_node: str = Query(..., description="Node ID to use as the 'current point in story'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force-regenerate the character journey summary up to the given node.
    Streams the LLM response and saves to cache on completion.
    """
    character = _verify_character_access(character_id, db, current_user)
    node = db.get(StructureNode, up_to_node)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    nodes_up_to = get_nodes_up_to(node.story_id, up_to_node, db)
    relevant_scenes = get_scenes_with_character(nodes_up_to, character)

    if not relevant_scenes:
        from fastapi.responses import Response
        # Still cache a placeholder so the UI can show "0 scenes found"
        cached = get_cached_journey(character_id, up_to_node, db)
        placeholder = f"I don't appear to have experienced anything notable in the story up to this point."
        save_journey(character_id, up_to_node, placeholder, [], db, existing=cached)
        return Response(placeholder, media_type="text/plain")

    scene_summaries = [(n.title, n.content_summary) for n in relevant_scenes]
    source_ids = [n.id for n in relevant_scenes]
    feature_prompt = build_journey_prompt(character, scene_summaries)
    llm_messages = [{"role": "user", "content": "Please provide the journey summary."}]

    cached = get_cached_journey(character_id, up_to_node, db)

    ctx = AICallContext(
        feature="character-journey",
        user_id=current_user.id,
        story_id=node.story_id,
        character_id=character_id,
        node_id=up_to_node,
        tags=["character", "journey", "lorebook", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        save_journey(character_id, up_to_node, result.content, source_ids, db, existing=cached)

    async def stream_and_persist():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
            include_core_prompt=False,
            on_complete=on_complete,
        ):
            yield token

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


@router.get("/{character_id}/arc-timeline")
def get_arc_timeline(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return ordered leaf scenes where this character appears, plus milestone data.
    Used by the Arc Journey timeline visualization.
    """
    character = _verify_character_access(character_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == character.story_id).all()

    # Build ordered leaf nodes
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    # Find milestone-to-scene mappings
    milestone_scene_ids: set[str] = {
        m["scene_id"] for m in (character.arc_milestones or []) if m.get("scene_id")
    }

    name_lower = character.name.lower()
    scenes = []
    for i, n in enumerate(leaves):
        if n.content and name_lower in n.content.lower():
            linked_milestones = [
                m["id"] for m in (character.arc_milestones or []) if m.get("scene_id") == n.id
            ]
            scenes.append({
                "id": n.id,
                "title": n.title or "Untitled",
                "position": i,
                "word_count": n.word_count,
                "status": n.status,
                "linked_milestones": linked_milestones,
            })

    total_leaves = len(leaves)
    appearance_rate = round(len(scenes) / total_leaves * 100, 1) if total_leaves > 0 else 0.0

    return {
        "character_id": character.id,
        "character_name": character.name,
        "scenes": scenes,
        "milestones": character.arc_milestones or [],
        "appearance_rate": appearance_rate,
        "total_scenes": total_leaves,
    }
