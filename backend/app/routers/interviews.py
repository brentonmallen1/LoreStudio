from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character
from ..models.interview import CharacterInterview
from ..schemas.interview import InterviewCreate, InterviewMessageRequest, InterviewOut, InterviewSummaryOut
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider
from ..services.llm.prompts import build_character_interview_system_prompt

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
def list_interviews(
    character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
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
    interview = CharacterInterview(character_id=character_id, title=title, messages=[])
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

    # Append user message
    user_msg = {"role": "user", "content": body.content, "timestamp": datetime.now(timezone.utc).isoformat()}
    messages = list(interview.messages)
    messages.append(user_msg)
    interview.messages = messages
    db.commit()

    system_prompt = build_character_interview_system_prompt(character)
    llm_messages = [{"role": m["role"], "content": m["content"]} for m in messages]

    async def stream_and_persist():
        full_response = []
        try:
            async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
                full_response.append(token)
                yield token
        finally:
            # Persist assistant response after stream completes
            if full_response:
                assistant_msg = {
                    "role": "assistant",
                    "content": "".join(full_response),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                updated_messages = list(interview.messages) + [assistant_msg]
                interview.messages = updated_messages
                db.commit()

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(
    interview_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    interview = _verify_interview_access(interview_id, db, current_user)
    db.delete(interview)
    db.commit()
