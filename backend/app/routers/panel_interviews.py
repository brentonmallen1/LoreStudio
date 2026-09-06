import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.chat_message import ChatMessage
from ..models.chat_session import ChatSession
from ..models.panel_interview import PanelInterview
from ..models.story import Story
from ..models.user import User
from ..schemas.ai_responses import PanelOrchestratorResponse
from ..schemas.panel_interview import (
    PanelInterviewCreate,
    PanelInterviewOut,
    PanelInterviewSummaryOut,
    PanelMessageRequest,
)
from ..services.codex.context import assemble_panel_member
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.panel import (
    build_panel_orchestrator_prompt,
    format_history_with_labels,
)

router = APIRouter()


def _get_or_create_chronicle_session(panel: PanelInterview, user: User, db: Session) -> ChatSession:
    """Get or create a Chronicle session for this panel interview."""
    existing = (
        db.query(ChatSession)
        .filter(
            ChatSession.user_id == user.id,
            ChatSession.context_type == "panel",
            ChatSession.context_id == panel.id,
        )
        .first()
    )
    if existing:
        return existing

    session = ChatSession(
        story_id=panel.story_id,
        user_id=user.id,
        context_type="panel",
        context_id=panel.id,
        context_label=panel.title,
        title=panel.title,
    )
    db.add(session)
    db.flush()
    return session


def _add_chronicle_message(
    chronicle_session: ChatSession, role: str, content: str, db: Session, model: str = ""
) -> None:
    """Add a message to the Chronicle session."""
    msg = ChatMessage(
        session_id=chronicle_session.id,
        role=role,
        content=content,
        model=model,
    )
    chronicle_session.updated_at = datetime.now(UTC)
    db.add(msg)
    db.flush()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_panel_access(panel_id: str, db: Session, user: User) -> PanelInterview:
    panel = db.get(PanelInterview, panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel interview not found")
    _verify_story_access(panel.story_id, db, user)
    return panel


@router.get("/stories/{story_id}/panels", response_model=list[PanelInterviewSummaryOut])
def list_panels(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _verify_story_access(story_id, db, current_user)
    panels = (
        db.query(PanelInterview)
        .filter(PanelInterview.story_id == story_id)
        .order_by(PanelInterview.updated_at.desc())
        .all()
    )
    return [
        PanelInterviewSummaryOut(
            id=p.id,
            story_id=p.story_id,
            title=p.title,
            character_ids=p.character_ids,
            message_count=len(p.messages),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in panels
    ]


@router.post("/stories/{story_id}/panels", response_model=PanelInterviewOut, status_code=status.HTTP_201_CREATED)
def create_panel(
    story_id: str,
    body: PanelInterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    if len(body.character_ids) < 2:
        raise HTTPException(status_code=400, detail="Panel interview requires at least 2 characters")
    # Verify all characters belong to this story
    for cid in body.character_ids:
        c = db.get(Character, cid)
        if not c or c.story_id != story_id:
            raise HTTPException(status_code=400, detail=f"Character {cid} not found in this story")

    names = []
    for cid in body.character_ids:
        c = db.get(Character, cid)
        if c:
            names.append(c.name)
    title = body.title or f"Panel: {', '.join(names)}"

    if len(body.character_ids) > 3:
        raise HTTPException(status_code=400, detail="Panel interview supports at most 3 characters")

    panel = PanelInterview(
        story_id=story_id,
        title=title,
        character_ids=body.character_ids,
        messages=[],
        settings=(body.settings.model_dump() if body.settings else {}),
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return panel


@router.get("/panels/{panel_id}", response_model=PanelInterviewOut)
def get_panel(panel_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_panel_access(panel_id, db, current_user)


@router.post("/panels/{panel_id}/messages")
async def send_panel_message(
    panel_id: str,
    body: PanelMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    panel = _verify_panel_access(panel_id, db, current_user)

    characters = []
    for cid in panel.character_ids:
        c = db.get(Character, cid)
        if c:
            characters.append(c)

    char_by_name = {c.name: c for c in characters}

    settings = panel.settings or {}
    max_rounds = min(int(settings.get("max_rounds", 2)), 4)

    chronicle_session = _get_or_create_chronicle_session(panel, current_user, db)

    user_msg = {
        "role": "user",
        "content": body.content,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    messages = list(panel.messages) + [user_msg]
    panel.messages = messages
    _add_chronicle_message(chronicle_session, "user", body.content, db)
    db.commit()

    orch_ctx = AICallContext(
        feature="panel-orchestrator",
        user_id=current_user.id,
        story_id=panel.story_id,
        tags=["panel", "orchestrator"],
    )

    def _sse(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    async def stream_panel():
        current_messages = list(panel.messages)
        round_num = 1

        while round_num <= max_rounds:
            # Orchestrator: decide who speaks and in what order
            orch_result = await ai_gateway.generate_structured(
                response_model=PanelOrchestratorResponse,
                messages=[{"role": "user", "content": format_history_with_labels(current_messages)}],
                feature_prompt=build_panel_orchestrator_prompt(characters, current_messages, round_num, max_rounds),
                context=orch_ctx,
                db=db,
                user=current_user,
                llm_params=body.llm_params,
                include_core_prompt=False,
            )

            if not orch_result.success or not orch_result.data:
                yield _sse({"type": "done"})
                return

            speakers: list[str] = orch_result.data.get("speakers", [])
            round_complete: bool = orch_result.data.get("round_complete", True)

            if not speakers:
                yield _sse({"type": "done"})
                return

            # Stream each character in order
            for char_name in speakers:
                character = char_by_name.get(char_name)
                if not character:
                    continue

                other_characters = [c for c in characters if c.id != character.id]

                # Assembled in one place, so the transparency view shows this prompt and
                # not a persona with no idea what it lived through (doc 07 §5).
                char_prompt = assemble_panel_member(
                    character, other_characters, db, response_length=body.response_length
                ).prompt

                llm_messages = [
                    {
                        "role": "user" if m["role"] == "user" else "assistant",
                        "content": m["content"],
                    }
                    for m in current_messages
                ]

                yield _sse({"type": "start", "character": char_name, "character_id": character.id})

                char_tokens: list[str] = []

                char_ctx = AICallContext(
                    feature="panel-character",
                    user_id=current_user.id,
                    story_id=panel.story_id,
                    tags=["panel", "character", "interview", "persisted"],
                )

                async for token in ai_gateway.stream(
                    messages=llm_messages,
                    feature_prompt=char_prompt,
                    context=char_ctx,
                    db=db,
                    user=current_user,
                    llm_params=body.llm_params,
                    include_core_prompt=False,
                ):
                    char_tokens.append(token)
                    yield _sse({"type": "token", "character": char_name, "token": token})

                full_content = "".join(char_tokens).strip()

                # Strip [pass] responses — character chose not to speak
                if full_content == "[pass]":
                    yield _sse({"type": "pass", "character": char_name})
                else:
                    char_msg = {
                        "role": "character",
                        "character_id": character.id,
                        "character_name": char_name,
                        "content": full_content,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                    current_messages = current_messages + [char_msg]
                    panel.messages = current_messages
                    _add_chronicle_message(chronicle_session, "assistant", f"[{char_name}]: {full_content}", db)
                    db.commit()

                yield _sse({"type": "end", "character": char_name})

            if round_complete or round_num >= max_rounds:
                break

            round_num += 1

        yield _sse({"type": "done"})

    return StreamingResponse(stream_panel(), media_type="text/event-stream")


@router.delete("/panels/{panel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_panel(panel_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    panel = _verify_panel_access(panel_id, db, current_user)
    # Also delete associated Chronicle session
    chronicle_session = (
        db.query(ChatSession)
        .filter(
            ChatSession.user_id == current_user.id,
            ChatSession.context_type == "panel",
            ChatSession.context_id == panel.id,
        )
        .first()
    )
    if chronicle_session:
        db.delete(chronicle_session)
    db.delete(panel)
    db.commit()
