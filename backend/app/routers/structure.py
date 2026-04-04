from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.structure import StructureNodeUpdate, StructureNodeOut
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext, AICallResult
from ..services.llm.prompts.summaries import build_scene_summary_prompt

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
        data["metadata_"] = data.pop("metadata_")
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
    return node


@router.post("/{node_id}/summarize")
async def summarize_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream an AI-generated summary of the scene content, then persist it."""
    node = _verify_node_access(node_id, db, current_user)

    if not node.content or not node.content.strip():
        from fastapi.responses import Response
        return Response("No content to summarize.", media_type="text/plain")

    feature_prompt = build_scene_summary_prompt(node.title, node.content)
    llm_messages = [{"role": "user", "content": f"Scene: {node.title}\n\n{node.content}"}]

    story = db.query(Story).filter(Story.id == node.story_id).first()
    ctx = AICallContext(
        feature="scene-summary",
        user_id=current_user.id,
        story_id=node.story_id,
        node_id=node_id,
        tags=["manuscript", "summarization", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        node.content_summary = result.content
        node.summary_stale = False
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
