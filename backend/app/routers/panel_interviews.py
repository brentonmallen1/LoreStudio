from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.character import Character
from ..models.panel_interview import PanelInterview
from ..schemas.panel_interview import (
    PanelInterviewCreate,
    PanelMessageRequest,
    PanelInterviewOut,
    PanelInterviewSummaryOut,
)
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider
from ..services.llm.prompts import build_panel_interview_system_prompt

router = APIRouter()


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
def list_panels(
    story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
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
    story = _verify_story_access(story_id, db, current_user)
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

    panel = PanelInterview(
        story_id=story_id,
        title=title,
        character_ids=body.character_ids,
        messages=[],
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return panel


@router.get("/panels/{panel_id}", response_model=PanelInterviewOut)
def get_panel(
    panel_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _verify_panel_access(panel_id, db, current_user)


@router.post("/panels/{panel_id}/messages")
async def send_panel_message(
    panel_id: str,
    body: PanelMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    panel = _verify_panel_access(panel_id, db, current_user)

    # Load characters in order
    characters = []
    for cid in panel.character_ids:
        c = db.get(Character, cid)
        if c:
            characters.append(c)

    # Append user message
    user_msg = {
        "role": "user",
        "content": body.content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    messages = list(panel.messages)
    messages.append(user_msg)
    panel.messages = messages
    db.commit()

    system_prompt = build_panel_interview_system_prompt(characters)
    llm_messages = [{"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]} for m in messages]

    async def stream_and_persist():
        full_response = []
        try:
            async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
                full_response.append(token)
                yield token
        finally:
            if full_response:
                panel_msg = {
                    "role": "panel",
                    "content": "".join(full_response),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                updated_messages = list(panel.messages) + [panel_msg]
                panel.messages = updated_messages
                db.commit()

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


@router.delete("/panels/{panel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_panel(
    panel_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    panel = _verify_panel_access(panel_id, db, current_user)
    db.delete(panel)
    db.commit()
