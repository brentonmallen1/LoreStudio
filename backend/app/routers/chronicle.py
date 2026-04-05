"""
Chronicle router — history, logs, and AI audit trail.

Endpoints:
  GET  /chronicle/sessions                 List chat sessions (filterable, paginated)
  POST /chronicle/sessions                 Create a new session
  GET  /chronicle/sessions/{id}            Get session with full message history
  PATCH /chronicle/sessions/{id}           Update session (title, archive)
  DELETE /chronicle/sessions/{id}          Delete session
  POST /chronicle/sessions/{id}/messages   Append a message to a session

  GET  /chronicle/activity                 List activity logs (filterable, paginated)
  POST /chronicle/activity                 Create an activity log entry

  GET  /chronicle/search                   Full-text search across sessions and logs
  GET  /chronicle/stats                    Aggregate statistics
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.chat_session import ChatSession
from ..models.chat_message import ChatMessage
from ..models.activity_log import ActivityLog
from ..models.user import User
from ..auth.dependencies import get_current_user
from ..schemas.chronicle import (
    ChatSessionCreate, ChatSessionUpdate, ChatSessionOut, ChatSessionDetail,
    ChatMessageCreate, ChatMessageOut,
    ActivityLogOut,
    SessionListResponse, ActivityListResponse,
    SearchResponse, SearchResult,
    ChronicleStats,
)

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────

def _session_or_404(session_id: str, db: Session, user: User) -> ChatSession:
    s = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def _session_to_out(s: ChatSession) -> ChatSessionOut:
    last = s.messages[-1] if s.messages else None
    preview = None
    if last:
        text = last.content[:120].replace("\n", " ").strip()
        preview = f"{text}…" if len(last.content) > 120 else text
    return ChatSessionOut(
        id=s.id,
        story_id=s.story_id,
        user_id=s.user_id,
        context_type=s.context_type,
        context_id=s.context_id,
        context_label=s.context_label,
        title=s.title,
        archived=s.archived,
        created_at=s.created_at,
        updated_at=s.updated_at,
        message_count=len(s.messages),
        last_message_preview=preview,
    )


# ── Session endpoints ──────────────────────────────────────────────────

@router.get("/chronicle/sessions", response_model=SessionListResponse)
def list_sessions(
    story_id: str | None = Query(None),
    context_type: str | None = Query(None),
    context_id: str | None = Query(None),
    archived: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ChatSession).filter(
        ChatSession.user_id == user.id,
        ChatSession.archived == archived,
    )
    if story_id:
        q = q.filter(ChatSession.story_id == story_id)
    if context_type:
        q = q.filter(ChatSession.context_type == context_type)
    if context_id:
        q = q.filter(ChatSession.context_id == context_id)

    total = q.count()
    sessions = q.order_by(ChatSession.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return SessionListResponse(
        sessions=[_session_to_out(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/chronicle/sessions", response_model=ChatSessionOut)
def create_session(
    body: ChatSessionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = ChatSession(
        story_id=body.story_id,
        user_id=user.id,
        context_type=body.context_type,
        context_id=body.context_id,
        context_label=body.context_label,
        title=body.title,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


@router.get("/chronicle/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _session_or_404(session_id, db, user)
    return ChatSessionDetail(
        **_session_to_out(s).model_dump(),
        messages=[ChatMessageOut.model_validate(m) for m in s.messages],
    )


@router.patch("/chronicle/sessions/{session_id}", response_model=ChatSessionOut)
def update_session(
    session_id: str,
    body: ChatSessionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _session_or_404(session_id, db, user)
    if body.title is not None:
        s.title = body.title
    if body.archived is not None:
        s.archived = body.archived
    db.commit()
    db.refresh(s)
    return _session_to_out(s)


@router.delete("/chronicle/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _session_or_404(session_id, db, user)
    db.delete(s)
    db.commit()


@router.post("/chronicle/sessions/{session_id}/messages", response_model=ChatMessageOut)
def add_message(
    session_id: str,
    body: ChatMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = _session_or_404(session_id, db, user)
    msg = ChatMessage(
        session_id=s.id,
        role=body.role,
        content=body.content,
        model=body.model,
        tokens_in=body.tokens_in,
        tokens_out=body.tokens_out,
    )
    # Bump session updated_at so it floats to top of lists
    s.updated_at = datetime.utcnow()
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return ChatMessageOut.model_validate(msg)


# ── Activity log endpoints ─────────────────────────────────────────────

@router.get("/chronicle/activity", response_model=ActivityListResponse)
def list_activity(
    story_id: str | None = Query(None),
    category: str | None = Query(None),
    event_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ActivityLog).filter(ActivityLog.user_id == user.id)
    if story_id:
        q = q.filter(ActivityLog.story_id == story_id)
    if category:
        q = q.filter(ActivityLog.category == category)
    if event_type:
        q = q.filter(ActivityLog.event_type == event_type)

    total = q.count()
    logs = q.order_by(ActivityLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return ActivityListResponse(
        logs=[ActivityLogOut(
            id=log.id,
            user_id=log.user_id,
            story_id=log.story_id,
            event_type=log.event_type,
            category=log.category,
            description=log.description,
            metadata_=log.metadata_,
            created_at=log.created_at,
        ) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/chronicle/activity", status_code=201)
def log_activity(
    story_id: str | None = Query(None),
    event_type: str = Query(...),
    category: str = Query(...),
    description: str = Query(...),
    metadata: dict = {},
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    log = ActivityLog(
        user_id=user.id,
        story_id=story_id,
        event_type=event_type,
        category=category,
        description=description,
        metadata_=metadata,
    )
    db.add(log)
    db.commit()
    return {"ok": True}


# ── Search ─────────────────────────────────────────────────────────────

@router.get("/chronicle/search", response_model=SearchResponse)
def search_chronicle(
    q: str = Query(..., min_length=1),
    story_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    results: list[SearchResult] = []
    term = f"%{q}%"

    # Search chat messages — group by session, return matching sessions
    msg_q = (
        db.query(ChatSession, ChatMessage)
        .join(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .filter(
            ChatSession.user_id == user.id,
            ChatSession.archived == False,
            ChatMessage.content.ilike(term),
        )
    )
    if story_id:
        msg_q = msg_q.filter(ChatSession.story_id == story_id)

    seen_sessions: set[str] = set()
    for session, message in msg_q.all():
        if session.id not in seen_sessions:
            seen_sessions.add(session.id)
            # Build a short excerpt around the match
            content = message.content
            idx = content.lower().find(q.lower())
            start = max(0, idx - 60)
            end = min(len(content), idx + 120)
            excerpt = ("…" if start > 0 else "") + content[start:end] + ("…" if end < len(content) else "")
            results.append(SearchResult(
                type="session",
                session=_session_to_out(session),
                excerpt=excerpt,
            ))

    # Search activity logs
    log_q = db.query(ActivityLog).filter(
        ActivityLog.user_id == user.id,
        ActivityLog.description.ilike(term),
    )
    if story_id:
        log_q = log_q.filter(ActivityLog.story_id == story_id)

    for log in log_q.all():
        results.append(SearchResult(
            type="activity",
            log=ActivityLogOut(
                id=log.id,
                user_id=log.user_id,
                story_id=log.story_id,
                event_type=log.event_type,
                category=log.category,
                description=log.description,
                metadata_=log.metadata_,
                created_at=log.created_at,
            ),
            excerpt=log.description[:200],
        ))

    total = len(results)
    # Sort by recency: sessions by updated_at, logs by created_at
    def sort_key(r: SearchResult):
        if r.session:
            return r.session.updated_at
        if r.log:
            return r.log.created_at
        return datetime.min

    results.sort(key=sort_key, reverse=True)
    paginated = results[(page - 1) * page_size: page * page_size]

    return SearchResponse(results=paginated, total=total, query=q)


# ── Stats ──────────────────────────────────────────────────────────────

@router.get("/chronicle/stats", response_model=ChronicleStats)
def get_stats(
    story_id: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session_q = db.query(ChatSession).filter(ChatSession.user_id == user.id)
    if story_id:
        session_q = session_q.filter(ChatSession.story_id == story_id)

    sessions = session_q.all()
    total_sessions = len(sessions)
    total_messages = sum(len(s.messages) for s in sessions)

    sessions_by_type: dict[str, int] = {}
    for s in sessions:
        sessions_by_type[s.context_type] = sessions_by_type.get(s.context_type, 0) + 1

    log_q = db.query(ActivityLog).filter(ActivityLog.user_id == user.id)
    if story_id:
        log_q = log_q.filter(ActivityLog.story_id == story_id)
    total_logs = log_q.count()
    ai_count = log_q.filter(ActivityLog.category == "ai").count()

    return ChronicleStats(
        total_sessions=total_sessions,
        total_messages=total_messages,
        total_activity_logs=total_logs,
        sessions_by_type=sessions_by_type,
        ai_interactions=ai_count,
    )
