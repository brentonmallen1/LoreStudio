import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..models.location import Location
from ..models.discovered_element import DiscoveredElement
from ..auth.dependencies import get_current_user
from ..schemas.discovered_element import (
    DiscoveredElementOut,
    DiscoveredElementApprove,
    DiscoveryRunRequest,
)
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.discovery import build_discovery_prompt

router = APIRouter()

ELEMENT_TYPE_ICONS = {
    "character": "👤",
    "setting": "📍",
    "relationship": "🔗",
    "theme": "💡",
    "object": "📦",
}


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _strip_html(html: str) -> str:
    """Very basic HTML tag stripping for prose text sent to LLM."""
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


@router.post("/stories/{story_id}/discover", response_model=list[DiscoveredElementOut])
async def run_discovery(
    story_id: str,
    body: DiscoveryRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run discovery analysis on a scene (or recent scenes) to infer new story elements."""
    story = _get_story(story_id, db, current_user)

    if not story.discovery_enabled:
        raise HTTPException(status_code=400, detail="Discovery is disabled for this story")

    # Gather prose to analyze
    if body.node_id:
        node = db.get(StructureNode, body.node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
        prose = _strip_html(node.content or "")
        if not prose:
            return []
        nodes_analyzed = [node]
    else:
        # Analyze the 5 most recently updated leaf scenes with content
        nodes_analyzed = (
            db.query(StructureNode)
            .filter(
                StructureNode.story_id == story_id,
                StructureNode.content.isnot(None),
                StructureNode.content != "",
            )
            .order_by(StructureNode.updated_at.desc())
            .limit(5)
            .all()
        )
        if not nodes_analyzed:
            return []
        prose_parts = [_strip_html(n.content or "") for n in nodes_analyzed]
        prose = "\n\n---\n\n".join(p for p in prose_parts if p)

    # Build existing entity lists to avoid re-suggesting known elements
    existing_characters = [c.name for c in db.query(Character).filter(Character.story_id == story_id).all()]
    existing_settings = [l.name for l in db.query(Location).filter(Location.story_id == story_id).all()]

    element_types = story.discovery_element_types or ["character", "setting", "relationship"]

    feature_prompt = build_discovery_prompt(
        prose=prose,
        element_types=element_types,
        existing_characters=existing_characters,
        existing_settings=existing_settings,
    )

    # Collect the full LLM response (non-streaming — we need to parse JSON)
    full_response = ""
    ctx = AICallContext(
        feature="discovery",
        user_id=current_user.id,
        story_id=story_id,
        node_id=body.node_id,
        tags=["discovery", "user-initiated"],
    )

    async for token in ai_gateway.stream(
        messages=[{"role": "user", "content": "Analyze this prose for new story elements."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    ):
        full_response += token

    # Parse JSON from LLM response
    try:
        # Strip any markdown fencing the model might add despite instructions
        clean = full_response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
            clean = clean.strip()
        data = json.loads(clean)
        raw_discoveries = data.get("discoveries", [])
    except (json.JSONDecodeError, KeyError):
        return []

    min_confidence = story.discovery_min_confidence or 0.6
    created = []
    for d in raw_discoveries:
        if not isinstance(d, dict):
            continue
        confidence = float(d.get("confidence", 0.0))
        if confidence < min_confidence:
            continue
        element_type = d.get("element_type", "")
        if element_type not in element_types:
            continue
        name = (d.get("name") or "").strip()
        if not name:
            continue

        # Skip if already pending/approved with same name in this story
        existing = db.query(DiscoveredElement).filter(
            DiscoveredElement.story_id == story_id,
            DiscoveredElement.name == name,
            DiscoveredElement.element_type == element_type,
            DiscoveredElement.status == "pending",
        ).first()
        if existing:
            continue

        element = DiscoveredElement(
            id=str(uuid.uuid4()),
            story_id=story_id,
            element_type=element_type,
            name=name,
            description=d.get("description", ""),
            confidence=confidence,
            source_node_id=nodes_analyzed[0].id if len(nodes_analyzed) == 1 else None,
            source_excerpt=d.get("source_excerpt", ""),
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(element)
        created.append(element)

    db.commit()
    for e in created:
        db.refresh(e)

    return created


@router.get("/stories/{story_id}/discoveries", response_model=list[DiscoveredElementOut])
def list_discoveries(
    story_id: str,
    status: str = "pending",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List discovered elements by status (pending/approved/rejected)."""
    _get_story(story_id, db, current_user)
    return (
        db.query(DiscoveredElement)
        .filter(DiscoveredElement.story_id == story_id, DiscoveredElement.status == status)
        .order_by(DiscoveredElement.created_at.desc())
        .all()
    )


@router.get("/stories/{story_id}/discoveries/count")
def count_pending_discoveries(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return count of pending discoveries (used for sidebar badge)."""
    _get_story(story_id, db, current_user)
    count = (
        db.query(DiscoveredElement)
        .filter(DiscoveredElement.story_id == story_id, DiscoveredElement.status == "pending")
        .count()
    )
    return {"count": count}


@router.post("/discoveries/{element_id}/approve", response_model=DiscoveredElementOut)
def approve_discovery(
    element_id: str,
    body: DiscoveredElementApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a discovery — creates the entity in the Lorebook and marks as approved."""
    element = db.get(DiscoveredElement, element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Discovery not found")
    _get_story(element.story_id, db, current_user)

    name = body.name or element.name
    description = body.description or element.description
    now = datetime.now(timezone.utc)

    merged_to_type = None
    merged_to_id = None

    if element.element_type == "character":
        entity = Character(
            id=str(uuid.uuid4()),
            story_id=element.story_id,
            name=name,
            background=description,
            role="supporting",
        )
        db.add(entity)
        db.flush()
        merged_to_type = "character"
        merged_to_id = entity.id

    elif element.element_type == "setting":
        entity = Location(
            id=str(uuid.uuid4()),
            story_id=element.story_id,
            name=name,
            description=description,
            is_stub=True,
            discovered_from_id=element.id,
            discovered_at=now,
        )
        db.add(entity)
        db.flush()
        merged_to_type = "location"
        merged_to_id = entity.id

    # For relationship/theme/object: mark approved but no automatic entity creation
    # (writer manually handles these in Lorebook)

    element.status = "approved"
    element.merged_to_type = merged_to_type
    element.merged_to_id = merged_to_id
    element.reviewed_at = now

    db.commit()
    db.refresh(element)
    return element


@router.post("/discoveries/{element_id}/reject", response_model=DiscoveredElementOut)
def reject_discovery(
    element_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a discovery — marks as rejected so it won't re-surface for the same text."""
    element = db.get(DiscoveredElement, element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Discovery not found")
    _get_story(element.story_id, db, current_user)
    element.status = "rejected"
    element.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(element)
    return element


@router.delete("/discoveries/{element_id}", status_code=204)
def delete_discovery(
    element_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently remove a discovery from the queue."""
    element = db.get(DiscoveredElement, element_id)
    if not element:
        raise HTTPException(status_code=404, detail="Discovery not found")
    _get_story(element.story_id, db, current_user)
    db.delete(element)
    db.commit()
