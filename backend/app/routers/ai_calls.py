"""
The AI call record: one endpoint per question the author might ask about a call.

Doc 06 §3 and §9. Every AI result in the app links here, so "show me what was sent"
returns *this* call — the messages, the options, the raw response — rather than a
freshly-built preview that may not match what actually went out.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.user import User
from ..services.ai_call_log import get_call, purge_payloads
from ..services.llm.features import get_feature

router = APIRouter()


class AICallPayloadOut(BaseModel):
    system_prompt: str
    messages: list
    raw_response: str
    thinking: str | None
    options: dict
    response_format: dict | None
    context_sources: list
    error: str | None


class AICallOut(BaseModel):
    id: str
    feature: str
    feature_label: str
    #: The co-author contract this feature works under; None for a feature since removed.
    classification: str | None
    story_id: str | None
    created_at: datetime
    status: str
    model: str | None
    tokens_in: int | None
    tokens_out: int | None
    latency_ms: int | None
    starred: bool
    #: Absent once the payload has aged out of its retention window, or been purged.
    payload: AICallPayloadOut | None


@router.get("/ai/calls/{log_id}", response_model=AICallOut)
def get_ai_call(log_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Everything recorded about one AI call."""
    found = get_call(db, log_id, user.id)
    if not found:
        raise HTTPException(status_code=404, detail="AI call not found")
    log, payload = found
    meta = log.metadata_ or {}
    feature_id = meta.get("feature", "")
    feature = get_feature(feature_id)
    return AICallOut(
        id=log.id,
        feature=feature_id,
        feature_label=feature.label if feature else (feature_id or log.event_type),
        classification=feature.classification if feature else None,
        story_id=log.story_id,
        created_at=log.created_at,
        # Calls recorded before statuses existed succeeded; they just did not say so.
        status=meta.get("status", "ok"),
        model=meta.get("model"),
        tokens_in=meta.get("tokens_in"),
        tokens_out=meta.get("tokens_out"),
        latency_ms=meta.get("latency_ms"),
        starred=log.starred,
        payload=AICallPayloadOut(
            system_prompt=payload.system_prompt,
            messages=payload.messages or [],
            raw_response=payload.raw_response,
            thinking=payload.thinking,
            options=payload.options or {},
            response_format=payload.response_format,
            context_sources=payload.context_sources or [],
            error=payload.error,
        )
        if payload
        else None,
    )


@router.delete("/ai/payloads")
def purge_ai_payloads(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Delete every stored prompt and response for this user. The record that the calls
    happened stays; only the prose goes (Settings › Privacy).
    """
    return {"removed": purge_payloads(db, user.id)}
