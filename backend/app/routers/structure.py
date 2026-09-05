from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.structure import StructureNodeUpdate, StructureNodeOut
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext, AICallResult
from ..services.llm.prompts.summaries import build_scene_summary_prompt, build_structure_section_summary_prompt
from ..services.dialogue_service import sync_dialogue_blocks
from ..services.linking_service import suggest_entity_links, apply_entity_links

router = APIRouter()


def _verify_node_access(node_id: str, db: Session, user: User) -> StructureNode:
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    story = db.query(Story).filter(Story.id == node.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/{node_id}", response_model=StructureNodeOut)
def get_node(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_node_access(node_id, db, current_user)


@router.patch("/{node_id}", response_model=StructureNodeOut)
def update_node(
    node_id: str,
    body: StructureNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = _verify_node_access(node_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "metadata_" in data:
        # Merge, never replace: different UI surfaces write different keys
        # (purpose, inline_notes, ...) of the same JSON column.
        data["metadata_"] = {**(node.metadata_ or {}), **data["metadata_"]}
    # If content is being updated, mark summary as stale (unless author is explicitly setting summary_stale)
    if "content" in data and "summary_stale" not in data:
        node.summary_stale = True
    # If author manually edits content_summary, treat it as fresh
    if "content_summary" in data and "summary_stale" not in data:
        data["summary_stale"] = False
    for key, value in data.items():
        setattr(node, key, value)
    db.commit()
    db.refresh(node)

    # Re-extract dialogue whenever content changes
    if "content" in data and node.content:
        story = db.get(Story, node.story_id)
        pov_char_id = node.pov_character_id or (story.pov_character_id if story else None)
        narrative_perspective = story.narrative_perspective if story else ""
        sync_dialogue_blocks(
            node.id, node.content, node.story_id, db,
            pov_character_id=pov_char_id,
            narrative_perspective=narrative_perspective,
        )

    return node


@router.post("/{node_id}/summarize")
async def summarize_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream an AI-generated summary of a scene or section, then persist it."""
    from fastapi.responses import Response

    node = _verify_node_access(node_id, db, current_user)
    story = db.query(Story).filter(Story.id == node.story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Leaf node: has direct prose content
    if node.content and node.content.strip():
        feature_prompt = build_scene_summary_prompt(node.title, node.content)
        llm_messages = [{"role": "user", "content": f"Scene: {node.title}\n\n{node.content}"}]
        feature = "scene-summary"
    else:
        # Section node: gather all child content recursively
        all_nodes = db.query(StructureNode).filter(StructureNode.story_id == node.story_id).all()
        child_map: dict[str | None, list[StructureNode]] = {}
        for n in all_nodes:
            child_map.setdefault(n.parent_id, []).append(n)

        def gather_content(n: StructureNode) -> list[str]:
            pieces = []
            if n.content and n.content.strip():
                pieces.append(f"[{n.title}]\n{n.content}")
            for child in sorted(child_map.get(n.id, []), key=lambda c: c.position):
                pieces.extend(gather_content(child))
            return pieces

        content_pieces = gather_content(node)
        if not content_pieces:
            return Response("No content to summarize in this section.", media_type="text/plain")

        feature_prompt = build_structure_section_summary_prompt(
            story_title=story.title,
            story_intent=getattr(story, "narrative_intent", None) or getattr(story, "intent", None),
            node_title=node.title,
            content_text="\n\n".join(content_pieces),
        )
        llm_messages = [{"role": "user", "content": "Summarize this section."}]
        feature = "structure-summary"

    ctx = AICallContext(
        feature=feature,
        user_id=current_user.id,
        story_id=node.story_id,
        node_id=node_id,
        tags=["manuscript", "summarization", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        node.content_summary = result.content
        node.summary_stale = False
        node.summary_updated_at = datetime.now(timezone.utc)
        db.commit()
        _invalidate_journey_summaries(node_id, db)

    async def stream_and_persist():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
            on_complete=on_complete,
        ):
            yield token

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


def _invalidate_journey_summaries(node_id: str, db: Session) -> None:
    """Mark journey summaries that included this node as stale."""
    try:
        from ..models.character_journey import CharacterJourneySummary
        affected = (
            db.query(CharacterJourneySummary)
            .filter(CharacterJourneySummary.source_node_ids.contains(node_id))
            .all()
        )
        for j in affected:
            j.is_stale = True
        if affected:
            db.commit()
    except Exception:
        pass  # Model may not exist yet if migration hasn't run


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    node = _verify_node_access(node_id, db, current_user)
    db.delete(node)
    db.commit()


# ---------------------------------------------------------------------------
# Entity linking endpoints
# ---------------------------------------------------------------------------

class ProposedEntityLink(BaseModel):
    id: str
    entity_type: str          # "character" | "location"
    entity_id: str
    entity_name: str
    matched_text: str
    text_start: int
    confidence: float
    source_excerpt: str


class ApplyLinkRequest(BaseModel):
    matched_text: str
    entity_name: str
    entity_type: str          # "character" | "location"


class ApplyLinksBody(BaseModel):
    links: list[ApplyLinkRequest]


@router.post("/{node_id}/suggest-links", response_model=list[ProposedEntityLink])
def suggest_links(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan scene for unlinked character and location mentions and propose @/[[]] links."""
    node = _verify_node_access(node_id, db, current_user)
    if not node.content:
        return []
    return suggest_entity_links(node.content, node.story_id, db)


@router.post("/{node_id}/apply-links", response_model=StructureNodeOut)
def apply_links(
    node_id: str,
    body: ApplyLinksBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply approved entity link proposals to scene content."""
    node = _verify_node_access(node_id, db, current_user)
    if not body.links:
        return StructureNodeOut.model_validate(node)

    updated_content = apply_entity_links(
        node.content or "",
        [link.model_dump() for link in body.links],
    )
    node.content = updated_content
    db.commit()
    db.refresh(node)
    return StructureNodeOut.model_validate(node)
