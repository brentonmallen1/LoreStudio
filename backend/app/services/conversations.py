"""Interviews and group interviews as Chronicle conversations (doc 13 P1).

Both keep their history on their own row (`CharacterInterview.messages`,
`PanelInterview.messages`) and mirror every line into a Chronicle `ChatSession`, so they are
listed, read back and deleted with every other conversation. The session's `context_type`
says which kind it mirrors ("interview" or "panel") and `context_id` names the row.

Clearing a conversation archives its Chronicle session rather than wiping it: the transcript
stays readable, and the next message opens a fresh one. Deleting the live session deletes the
conversation itself; deleting an archived transcript leaves the conversation alone.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.chat_message import ChatMessage
from ..models.chat_session import ChatSession
from ..models.interview import CharacterInterview
from ..models.panel_interview import PanelInterview
from ..models.user import User

MIRRORED = {"interview": CharacterInterview, "panel": PanelInterview}

SUMMARY_ROLE = "summary"
"""A compacted stretch of history, stored as the first message of a group interview."""


def live_session(db: Session, user: User, context_type: str, context_id: str) -> ChatSession | None:
    return (
        db.query(ChatSession)
        .filter(
            ChatSession.user_id == user.id,
            ChatSession.context_type == context_type,
            ChatSession.context_id == context_id,
            ChatSession.archived.is_(False),
        )
        .first()
    )


def chronicle_session(
    db: Session, user: User, *, story_id: str, context_type: str, context_id: str, label: str
) -> ChatSession:
    """The live Chronicle session mirroring this conversation, opened on first use."""
    existing = live_session(db, user, context_type, context_id)
    if existing:
        return existing
    session = ChatSession(
        story_id=story_id,
        user_id=user.id,
        context_type=context_type,
        context_id=context_id,
        context_label=label,
        title=label,
    )
    db.add(session)
    db.flush()
    return session


def add_message(
    session: ChatSession, role: str, content: str, db: Session, mentioned_refs: list[dict] | None = None
) -> None:
    session.updated_at = datetime.now(UTC)
    db.add(ChatMessage(session_id=session.id, role=role, content=content, mentioned_refs=mentioned_refs or None))
    db.flush()


def archive_sessions(db: Session, user: User, context_type: str, context_id: str) -> None:
    """Close the transcript: it stays in the Chronicle, and the next message starts another."""
    session = live_session(db, user, context_type, context_id)
    if session:
        session.archived = True


def delete_sessions(db: Session, user: User, context_type: str, context_id: str) -> None:
    """Every transcript of a conversation that is being deleted."""
    for s in (
        db.query(ChatSession)
        .filter(
            ChatSession.user_id == user.id,
            ChatSession.context_type == context_type,
            ChatSession.context_id == context_id,
        )
        .all()
    ):
        db.delete(s)


def delete_mirrored(db: Session, session: ChatSession) -> None:
    """Deleting the live transcript of an interview deletes the interview with it."""
    model = MIRRORED.get(session.context_type)
    if model is None or session.archived or not session.context_id:
        return
    row = db.get(model, session.context_id)
    if row is not None:
        db.delete(row)


def compact(messages: list[dict], summary: str, keep: int) -> list[dict]:
    """A group interview's history with everything but the last `keep` lines folded into one."""
    return [{"role": SUMMARY_ROLE, "content": summary, "timestamp": datetime.now(UTC).isoformat()}] + messages[-keep:]
