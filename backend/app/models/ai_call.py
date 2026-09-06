import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AICallPayload(Base):
    """
    Everything that was sent to and returned by the model for one AI call.

    Refactor doc 06 §3. The summary row stays in ActivityLog so the Chronicle list stays
    light; the prose lives here so it can be pruned on its own schedule
    (`AI_PAYLOAD_RETENTION_DAYS`, default 90) without losing the record that the call
    happened. One row per call, including calls that failed or were cancelled.
    """

    __tablename__ = "ai_call_payloads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    activity_log_id: Mapped[str] = mapped_column(
        String, ForeignKey("activity_logs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    #: The composed system prompt (core + feature prompt, user overrides applied).
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    #: Every message sent, in order, as the provider received them.
    messages: Mapped[list] = mapped_column(JSON, default=list)
    #: The response exactly as it came back — thinking blocks and all.
    raw_response: Mapped[str] = mapped_column(Text, default="")
    #: This call's own reasoning, split out of raw_response (not history thinking, which
    #: is stripped before sending).
    thinking: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The options actually sent: temperature, top_p, top_k, num_ctx, think, keep_alive.
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    #: JSON schema sent for structured calls, if any.
    response_format: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    #: Where the context came from, with provenance. Filled in by the assembler (doc 07 §5).
    context_sources: Mapped[list] = mapped_column(JSON, default=list)
    #: Error text for failed calls.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), index=True)
