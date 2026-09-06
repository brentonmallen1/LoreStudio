from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.interview import CharacterInterview
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.interview import (
    InterviewApplyRequest,
    InterviewCreate,
    InterviewMessageRequest,
    InterviewOut,
    InterviewSummaryOut,
    InterviewUpdate,
)
from ..services.character_journey import (
    build_journey_prompt,
    get_cached_journey,
    get_nodes_up_to,
    get_scenes_with_character,
    save_journey,
)
from ..services.character_knowledge import build_scope, describe_scope
from ..services.llm.gateway import AICallContext, AICallResult, ai_gateway
from ..services.llm.prompts.interviews import (
    build_character_interview_system_prompt,
    build_compaction_prompt,
    build_interview_summary_prompt,
)

router = APIRouter()


def _verify_character_access(character_id: str, db: Session, user: User) -> Character:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    story = db.query(Story).filter(Story.id == character.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


def _verify_interview_access(interview_id: str, db: Session, user: User) -> CharacterInterview:
    interview = db.get(CharacterInterview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    _verify_character_access(interview.character_id, db, user)
    return interview


@router.get("/characters/{character_id}", response_model=list[InterviewSummaryOut])
def list_interviews(character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _verify_character_access(character_id, db, current_user)
    interviews = (
        db.query(CharacterInterview)
        .filter(CharacterInterview.character_id == character_id)
        .order_by(CharacterInterview.updated_at.desc())
        .all()
    )
    return [
        InterviewSummaryOut(
            id=i.id,
            character_id=i.character_id,
            title=i.title,
            message_count=len(i.messages),
            created_at=i.created_at,
            updated_at=i.updated_at,
        )
        for i in interviews
    ]


@router.post("/characters/{character_id}", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def start_interview(
    character_id: str,
    body: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    character = _verify_character_access(character_id, db, current_user)
    title = body.title or f"Interview with {character.name}"
    interview = CharacterInterview(
        character_id=character_id,
        title=title,
        context_node_id=body.context_node_id if body.knowledge_scope == "as_of" else None,
        knowledge_scope=body.knowledge_scope,
        messages=[],
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.get("/{interview_id}", response_model=InterviewOut)
def get_interview(interview_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_interview_access(interview_id, db, current_user)


@router.post("/{interview_id}/messages")
async def send_message(
    interview_id: str,
    body: InterviewMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = _verify_interview_access(interview_id, db, current_user)
    character = db.get(Character, interview.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Append user message
    user_msg = {"role": "user", "content": body.content, "timestamp": datetime.now(UTC).isoformat()}
    messages = list(interview.messages)
    messages.append(user_msg)
    interview.messages = messages
    db.commit()

    # Fetch journey summary if interview has a story context point
    journey_summary: str | None = None
    if interview.context_node_id:
        context_node = db.get(StructureNode, interview.context_node_id)
        if context_node:
            cached = get_cached_journey(character.id, interview.context_node_id, db)
            if cached and cached.summary:
                journey_summary = cached.summary
            else:
                # Auto-generate journey on first message if not cached
                nodes_up_to = get_nodes_up_to(context_node.story_id, interview.context_node_id, db)
                relevant = get_scenes_with_character(nodes_up_to, character)
                if relevant:
                    scene_summaries = [(n.title, n.content_summary) for n in relevant]
                    source_ids = [n.id for n in relevant]
                    prompt = build_journey_prompt(character, scene_summaries)
                    ctx = AICallContext(
                        feature="character-journey",
                        user_id=current_user.id,
                        story_id=character.story_id,
                        character_id=character.id,
                        tags=["character", "journey", "interview", "auto"],
                    )
                    full_tokens: list[str] = []
                    async for token in ai_gateway.stream(
                        messages=[{"role": "user", "content": "Please provide the journey summary."}],
                        feature_prompt=prompt,
                        context=ctx,
                        db=db,
                        user=current_user,
                        include_core_prompt=False,
                    ):
                        full_tokens.append(token)
                    if full_tokens:
                        journey_summary = "".join(full_tokens)
                        save_journey(character.id, interview.context_node_id, journey_summary, source_ids, db)

    # Fetch most recent prior interview notes for session continuity
    previous_session_summary: str | None = None
    prior_interview = (
        db.query(CharacterInterview)
        .filter(
            CharacterInterview.character_id == character.id,
            CharacterInterview.id != interview_id,
            CharacterInterview.interview_notes.isnot(None),
        )
        .order_by(CharacterInterview.updated_at.desc())
        .first()
    )
    if prior_interview and prior_interview.interview_notes:
        previous_session_summary = prior_interview.interview_notes

    # Build feature prompt, prepending compacted summary if present
    compacted_summary_text: str | None = interview.compacted_summary or None
    # What this character was present for, up to the interview's story point. Without this
    # the persona answered questions about scenes it had never been in (doc 06 §6).
    scope = build_scope(character, db, interview.context_node_id, interview.knowledge_scope)
    feature_prompt = build_character_interview_system_prompt(
        character, journey_summary, previous_session_summary, describe_scope(character, scope)
    )
    if compacted_summary_text:
        feature_prompt = (
            f"{feature_prompt}\n\n"
            f"--- Earlier conversation summary (before history was compacted) ---\n"
            f"{compacted_summary_text}\n"
            f"--- End of earlier summary ---"
        )
    llm_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

    ctx = AICallContext(
        feature="interview",
        user_id=current_user.id,
        story_id=character.story_id,
        character_id=character.id,
        tags=["character", "interview", "conversation", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        assistant_msg = {
            "role": "assistant",
            "content": result.content,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        interview.messages = list(interview.messages) + [assistant_msg]
        db.commit()

    async def stream_and_persist():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
            llm_params=body.llm_params,
            include_core_prompt=False,
            on_complete=on_complete,
        ):
            yield token

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


@router.patch("/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: str,
    body: InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = _verify_interview_access(interview_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(interview, key, value)
    # Only an "as_of" interview is pinned to a scene; the other scopes let it go, or the
    # character would keep the knowledge of a story point the author moved away from.
    if body.knowledge_scope and body.knowledge_scope != "as_of":
        interview.context_node_id = None
    db.commit()
    db.refresh(interview)
    return interview


@router.post("/{interview_id}/summarize")
async def summarize_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = _verify_interview_access(interview_id, db, current_user)
    character = db.get(Character, interview.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    if not interview.messages:
        from fastapi.responses import Response

        return Response("No messages to summarize.", media_type="text/plain")

    feature_prompt = build_interview_summary_prompt(character, list(interview.messages))
    llm_messages = [{"role": "user", "content": "Please provide your analysis."}]

    ctx = AICallContext(
        feature="interview-summary",
        user_id=current_user.id,
        story_id=character.story_id,
        character_id=character.id,
        tags=["character", "interview", "summarization", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        interview.interview_notes = result.content
        db.commit()

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


@router.post("/{interview_id}/apply-to-character", response_model=None)
def apply_interview_to_character(
    interview_id: str,
    body: InterviewApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.character import Character as CharacterModel
    from ..schemas.character import CharacterOut

    interview = _verify_interview_access(interview_id, db, current_user)
    character = db.get(CharacterModel, interview.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    for field in body.fields:
        if field in body.content and hasattr(character, field):
            setattr(character, field, body.content[field])
    db.commit()
    db.refresh(character)
    return CharacterOut.model_validate(character)


COMPACT_THRESHOLD = 10  # Minimum messages before compaction is allowed
COMPACT_KEEP = 6  # Most recent messages to keep after compaction


@router.post("/{interview_id}/compact", response_model=None)
async def compact_interview(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summarize the oldest messages into a compacted context block to free up context space."""
    interview = _verify_interview_access(interview_id, db, current_user)
    character = db.get(Character, interview.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    messages = list(interview.messages)
    if len(messages) < COMPACT_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Interview needs at least {COMPACT_THRESHOLD} messages to compact (has {len(messages)})",
        )

    to_compact = messages[:-COMPACT_KEEP]
    to_keep = messages[-COMPACT_KEEP:]

    feature_prompt = build_compaction_prompt(character.name, to_compact)
    llm_messages = [{"role": "user", "content": "Please summarize these messages."}]

    ctx = AICallContext(
        feature="interview-compaction",
        user_id=current_user.id,
        story_id=character.story_id,
        character_id=character.id,
        tags=["character", "interview", "compaction", "user-initiated"],
    )

    tokens: list[str] = []
    async for token in ai_gateway.stream(
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
        include_core_prompt=False,
    ):
        tokens.append(token)
    result = "".join(tokens)

    # Prepend to existing compacted_summary (in case of multiple compactions)
    existing = interview.compacted_summary or ""
    separator = "\n\n---\n\n" if existing else ""
    interview.compacted_summary = existing + separator + result
    interview.messages = to_keep
    interview.compaction_count = (interview.compaction_count or 0) + 1
    db.commit()
    db.refresh(interview)
    return interview


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(interview_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    interview = _verify_interview_access(interview_id, db, current_user)
    db.delete(interview)
    db.commit()
