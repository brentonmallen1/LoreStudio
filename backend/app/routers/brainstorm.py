"""
"What's Next?" brainstorming assistant.

Streams direction suggestions, questions, and narrative possibilities to help
authors think through what happens next — without generating prose.
Reuses the scene context assembly from the chat router.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.llm_params import LLMParamsOverride
from ..services.codex.context import assemble_scene
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.brainstorm import build_brainstorm_system_prompt
from ..services.llm.sse import sse_stream

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories/{story_id}/brainstorm")
async def brainstorm_whats_next(
    story_id: str,
    node_id: str = Body(...),
    messages: list[dict] = Body(...),
    author_intent: dict | None = Body(None),
    llm_params: LLMParamsOverride | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream a brainstorming response grounded in the current scene's context.

    author_intent keys (all optional):
      - mood: desired mood/tone direction (e.g. "tense", "quiet")
      - goal: where to leave the reader
      - required_events: something that needs to happen
    """
    story = _get_story(story_id, db, current_user)
    node = db.get(StructureNode, node_id)
    if not node or node.story_id != story_id:
        raise HTTPException(status_code=404, detail="Scene not found")

    ctx = assemble_scene(story, node, db).packet
    feature_prompt = build_brainstorm_system_prompt(ctx, author_intent)

    call_ctx = AICallContext(
        feature="brainstorm",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "brainstorm", "direction", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=messages,
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
        llm_params=llm_params,
    )
