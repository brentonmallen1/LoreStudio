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

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.llm_params import LLMParamsOverride
from ..schemas.mentions import MentionedRef
from ..services.chronicle_log import add_message, get_or_create_session
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
from ..services.llm.sse import sse_message, sse_stream

router = APIRouter()


class ChatMessageIn(BaseModel):
    """
    One turn of the conversation.

    The endpoint used to take `list[dict]`, so a malformed history reached the provider and
    failed somewhere less obvious than the boundary it came in at (review §1.4).
    """

    role: Literal["user", "assistant", "system"]
    content: str = ""
    images: list[str] | None = None


class ChatRequest(BaseModel):
    node_id: str
    messages: list[ChatMessageIn]
    llm_params: LLMParamsOverride | None = None
    mode: str | None = None
    context_options: ContextOptions | None = None
    #: The Chronicle session this continues. Absent on the first message of a conversation.
    chronicle_session_id: str | None = None
    #: What the author @mentioned in the composer (doc 11 P6); added to the context, never replacing it.
    mentioned_refs: list[MentionedRef] = []


class SummarizeRequest(BaseModel):
    messages: list[ChatMessageIn]
    story_id: str | None = None


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
    body: ChatRequest,
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a chat response grounded in the current scene's full context."""
    node_id, messages = body.node_id, [m.model_dump() for m in body.messages]
    llm_params, mode, context_options = body.llm_params, body.mode, body.context_options
    story = _get_story(story_id, db, current_user)
    if node_id in VIRTUAL_NODE_IDS:
        node = None
    else:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")

    feature = mode if mode and get_feature(mode) else "scene-chat"
    ctx = assemble_scene(story, node, db, context_options, mentioned_refs=body.mentioned_refs).packet
    # The author's last message is the query the index is searched with. With no scene to
    # start from, the walk has no seed and the search is the whole story.
    ctx = attach_passages(
        ctx,
        await retrieve_for(
            db,
            story_id,
            next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), ""),
            feature=feature,
            seed_ref_ids=([node.id] if node else []) + [r.id for r in body.mentioned_refs],
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

    # The conversation goes in the Chronicle, which is what makes it resumable. The client
    # sends back the id it was given, so a reload continues the same thread.
    chronicle = get_or_create_session(
        db,
        current_user,
        story_id=story_id,
        context_type="story" if node is None else "scene",
        context_id=node_id,
        context_label=node.title if node else story.title,
        session_id=body.chronicle_session_id,
    )
    last_user = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")
    add_message(db, chronicle, "user", last_user, mentioned_refs=[r.model_dump() for r in body.mentioned_refs])

    def _save_answer(answer: str) -> None:
        # Synchronous, and in `finally`, for the same reason the call log is: a closed tab
        # mid-answer still leaves what was written in the Chronicle. What is stored is the
        # prose alone — the reasoning went out on its own event and was never part of it.
        add_message(db, chronicle, "assistant", answer)

    return sse_stream(
        ai_gateway,
        messages=messages,
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
        llm_params=llm_params,
        on_text=_save_answer,
        headers={
            "X-Chronicle-Session": chronicle.id,
            "Access-Control-Expose-Headers": "X-Chronicle-Session",
        },
    )


@router.post("/chat/summarize")
async def summarize_conversation(
    body: SummarizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a compact summary of the provided conversation messages."""
    messages = [m.model_dump() for m in body.messages]
    story_id = body.story_id
    if not messages:
        return sse_message("No messages to summarize.")

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

    return sse_stream(
        ai_gateway,
        messages=messages,
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
    )
