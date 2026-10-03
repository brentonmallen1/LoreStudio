import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.discovered_element import DiscoveredElement
from ..models.location import Location
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.discovered_element import (
    DiscoveredElementOut,
    DiscoveryRunRequest,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.discovery import build_discovery_prompt
from ..services.text_utils import prose_text

router = APIRouter()


class _DiscoveryItem(BaseModel):
    element_type: str
    name: str
    description: str = ""
    confidence: float = 0.5
    source_excerpt: str = ""


class _DiscoveryResponse(BaseModel):
    discoveries: list[_DiscoveryItem] = []


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
    """The prose sent to the model, as a reader sees it (entities decoded, no tags or syntax)."""
    return prose_text(html)


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
    existing_settings = [loc.name for loc in db.query(Location).filter(Location.story_id == story_id).all()]

    element_types = story.discovery_element_types or ["character", "setting", "relationship"]

    feature_prompt = build_discovery_prompt(
        prose=prose,
        element_types=element_types,
        existing_characters=existing_characters,
        existing_settings=existing_settings,
    )

    ctx = AICallContext(
        feature="discovery",
        user_id=current_user.id,
        story_id=story_id,
        node_id=body.node_id,
        tags=["discovery", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=_DiscoveryResponse,
        messages=[{"role": "user", "content": "Analyze this prose for new story elements."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    if not result.success:
        return []

    raw_discoveries: list[_DiscoveryItem] = _DiscoveryResponse.model_validate(result.data).discoveries

    min_confidence = story.discovery_min_confidence or 0.6
    created = []
    for d in raw_discoveries:
        if d.confidence < min_confidence:
            continue
        if d.element_type not in element_types:
            continue
        name = d.name.strip()
        if not name:
            continue

        # Skip if already pending/approved with same name in this story
        existing = (
            db.query(DiscoveredElement)
            .filter(
                DiscoveredElement.story_id == story_id,
                DiscoveredElement.name == name,
                DiscoveredElement.element_type == d.element_type,
                DiscoveredElement.status == "pending",
            )
            .first()
        )
        if existing:
            continue

        element = DiscoveredElement(
            id=str(uuid.uuid4()),
            story_id=story_id,
            element_type=d.element_type,
            name=name,
            description=d.description,
            confidence=d.confidence,
            source_node_id=nodes_analyzed[0].id if len(nodes_analyzed) == 1 else None,
            source_excerpt=d.source_excerpt,
            status="pending",
            created_at=datetime.now(UTC),
        )
        db.add(element)
        created.append(element)

    db.commit()
    for e in created:
        db.refresh(e)

    return created
