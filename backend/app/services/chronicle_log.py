"""
Writing conversations to the Chronicle (review §1.1).

CLAUDE.md names Chronicle as "conversation history, generated analyses, reports, activity
logs" and promises every AI interaction is logged and accessible. Half of that was true:
Stage 3 made every *call* durable, but the scene and story assistants wrote no session and
no messages at all, while the panel offered to resume conversations that were never
recorded. `createChronicleSession` and `addChronicleMessage` existed on the client with
zero call sites — designed, and never wired up.

It happens here rather than in the browser for the same reason the call log does: the
writes are synchronous and run in the streaming generator's `finally`, so a closed tab
mid-answer still leaves the conversation in the Chronicle rather than losing it.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.chat_message import ChatMessage
from ..models.chat_session import ChatSession
from ..models.user import User

logger = logging.getLogger(__name__)

#: Enough of the first message to recognise the conversation in a list.
TITLE_CHARS = 60


def get_or_create_session(
    db: Session,
    user: User,
    *,
    story_id: str,
    context_type: str,
    context_id: str,
    context_label: str,
    session_id: str | None = None,
) -> ChatSession:
    """
    The Chronicle session this conversation belongs to.

    `session_id` is the client saying which conversation it is continuing. It is checked
    against the user, so a stale or forged id starts a new session rather than appending
    to someone else's.
    """
    if session_id:
        existing = (
            db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user.id).one_or_none()
        )
        if existing:
            return existing

    session = ChatSession(
        story_id=story_id,
        user_id=user.id,
        context_type=context_type,
        context_id=context_id,
        context_label=context_label,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def add_message(db: Session, session: ChatSession, role: str, content: str, model: str = "") -> None:
    """
    Append one message. Failures are logged and swallowed.

    Losing a Chronicle row is bad; failing the author's answer because the Chronicle write
    failed would be worse. The conversation on screen is the thing they asked for.
    """
    if not content.strip():
        return
    try:
        db.add(ChatMessage(session_id=session.id, role=role, content=content, model=model))
        if role == "user" and not session.title:
            session.title = content[:TITLE_CHARS] + ("…" if len(content) > TITLE_CHARS else "")
        session.updated_at = datetime.now(UTC)
        db.commit()
    except Exception:
        logger.warning("Could not write %s message to Chronicle session %s", role, session.id, exc_info=True)
        db.rollback()
