import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .chat_message import ChatMessage
    from .story import Story


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # What this chat is about
    context_type: Mapped[str] = mapped_column(String, nullable=False)  # "scene", "character", "story", "panel"
    context_id: Mapped[str | None] = mapped_column(String, nullable=True)  # node_id, character_id, etc.
    context_label: Mapped[str] = mapped_column(String, default="")  # human-readable, e.g. scene title

    title: Mapped[str] = mapped_column(String, default="")  # auto-generated or user-set
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    #: Think first, chosen in the conversation's composer: None follows its feature's default.
    thinking: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )
