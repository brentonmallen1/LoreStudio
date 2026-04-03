from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.structure import StructureNodeUpdate, StructureNodeOut
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider

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

    system_prompt = (
        "You are a literary assistant helping an author document their story. "
        "Summarize the following scene in 2-3 sentences, focusing on key events and character actions. "
        "Write in present tense. Be specific and concise."
    )
    llm_messages = [{"role": "user", "content": f"Scene: {node.title}\n\n{node.content}"}]

    async def stream_and_persist():
        full_response = []
        try:
            async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
                full_response.append(token)
                yield token
        finally:
            if full_response:
                summary = "".join(full_response)
                node.content_summary = summary
                node.summary_stale = False
                db.commit()
                # Mark any character journey summaries that used this node as stale
                _invalidate_journey_summaries(node_id, db)

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
