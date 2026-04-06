"""
Scene Planner — AI-assisted scene planning before writing.

Generates structured suggestions for the scene's Notes fields:
synopsis, purpose, entry_state, exit_state, key_events.

Distinct from What's Next? (brainstorming during/after writing).
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.scene_planner import build_scene_planner_system_prompt
from ..schemas.llm_params import LLMParams
from .chat import _build_context_packet

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories/{story_id}/scene-plan")
async def scene_plan(
    story_id: str,
    node_id: str = Body(...),
    messages: list[dict] = Body(...),
    initial_notes: str | None = Body(None),
    llm_params: LLMParams | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream scene planning suggestions grounded in the story and scene context.

    initial_notes: Optional free-text from the author about what they already know.
    messages: Full conversation history (user + assistant turns for follow-ups).
    """
    story = _get_story(story_id, db, current_user)
    node = db.get(StructureNode, node_id)
    if not node or node.story_id != story_id:
        raise HTTPException(status_code=404, detail="Scene not found")

    ctx = _build_context_packet(story, node, db)
    feature_prompt = build_scene_planner_system_prompt(ctx, initial_notes)

    call_ctx = AICallContext(
        feature="scene-plan",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "planning", "structure", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=feature_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
                llm_params=llm_params,
            ):
                yield token
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")
