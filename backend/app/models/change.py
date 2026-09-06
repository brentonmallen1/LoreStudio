import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Change(Base):
    """One recorded mutation. Append-only: undoing writes a new row with ``undo_of`` set,
    redoing writes a row with ``redo_of`` set. ``batch_id`` groups the rows of one gesture
    (a reorder touches many nodes; one undo reverses them all).
    """

    __tablename__ = "changes"

    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    story_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=True, index=True
    )
    batch_id: Mapped[str] = mapped_column(String, default=lambda: str(uuid.uuid4()), index=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)  # structure_node, character, ...
    entity_id: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # create | update | delete | reorder | content
    before: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    label: Mapped[str] = mapped_column(String, default="")
    actor_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    client_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    undoable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    undo_of: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # batch_id this reverses
    redo_of: Mapped[str | None] = mapped_column(String, nullable=True, index=True)  # undo batch_id this re-applies
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), index=True)
