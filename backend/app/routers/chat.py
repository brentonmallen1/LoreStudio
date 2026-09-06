"""
Scene-aware chat assistant.

Assembles a rich context packet from everything the story knows about the current
scene, then streams a response.  Context includes:

  - Lorebook: title, genre, tone, themes, narrative intent, logline, premise
  - Active scene: title, synopsis, purpose, entry/exit state, key events, prose (truncated)
  - Characters @mentioned in the scene's prose (full profiles)
  - Plot threads touching this scene
  - Settings [[mentioned]] in the prose
  - Recent sibling scenes (titles + synopses) for narrative flow awareness
  - Author's unresolved goals

A /context endpoint (GET) returns the assembled context packet so the frontend
can show the author exactly what the AI is seeing.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.llm_params import LLMParamsOverride
from ..services.codex.context import (
    VIRTUAL_NODE_IDS,
    ContextOptions,
    assemble_scene,
    attach_passages,
    retrieve_for,
)
from ..services.llm.features import get_feature
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.chat import build_scene_chat_system_prompt, build_writing_coach_system_prompt

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


# ── Endpoints ──


@router.get("/stories/{story_id}/chat/context")
def get_chat_context(
    story_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the assembled context packet for preview — no AI call."""
    story = _get_story(story_id, db, current_user)
    if node_id in VIRTUAL_NODE_IDS:
        node = None
    else:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
    ctx = assemble_scene(story, node, db).packet
    return JSONResponse(ctx)


@router.post("/stories/{story_id}/chat")
async def scene_chat(
    story_id: str,
    node_id: str = Body(...),
    messages: list[dict] = Body(...),
    llm_params: LLMParamsOverride | None = Body(None),
    mode: str | None = Body(None),
    context_options: ContextOptions | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a chat response grounded in the current scene's full context."""
    story = _get_story(story_id, db, current_user)
    if node_id in VIRTUAL_NODE_IDS:
        node = None
    else:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")

    feature = mode if mode and get_feature(mode) else "scene-chat"
    ctx = assemble_scene(story, node, db, context_options).packet
    # The author's last message is the query the index is searched with. With no scene to
    # start from, the walk has no seed and the search is the whole story.
    ctx = attach_passages(
        ctx,
        await retrieve_for(
            db,
            story_id,
            next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), ""),
            feature=feature,
            seed_ref_ids=[node.id] if node else [],
            user=current_user,
            whole_story=node is None,
        ),
        db,
    )
    if mode == "writing-coach":
        feature_prompt = build_writing_coach_system_prompt(ctx)
    else:
        feature_prompt = build_scene_chat_system_prompt(ctx)

    call_ctx = AICallContext(
        feature=feature,
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "chat", "conversation", "user-initiated"],
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


@router.post("/chat/summarize")
async def summarize_conversation(
    messages: list[dict] = Body(...),
    story_id: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a compact summary of the provided conversation messages."""
    if not messages:
        from fastapi.responses import Response as FR

        return FR("No messages to summarize.", media_type="text/plain")

    feature_prompt = (
        "You are a conversation summarizer. "
        "Summarize the key points from the following conversation concisely, "
        "preserving important decisions, questions asked, creative ideas, and "
        "information exchanged. Write in past tense. Be thorough but concise — "
        "aim for 2-4 short paragraphs."
    )

    call_ctx = AICallContext(
        feature="conversation-summarize",
        user_id=current_user.id,
        story_id=story_id,
        tags=["chat", "summarization", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=feature_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
            ):
                yield token
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")
