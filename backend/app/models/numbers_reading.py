"""A reading: the Numbers page's figures at one moment (doc 19)."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class NumbersReading(Base):
    """
    The figures, not the text: a few KB per reading, kept on their own schedule (thinned to
    daily, then weekly) and apart from snapshots, which are pruned at thirty and can be turned
    off. A reading taken with a version keeps that version's name, and is never thinned.
    """

    __tablename__ = "numbers_readings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    #: session · daily · manual · snapshot · restore · backfill
    trigger: Mapped[str] = mapped_column(String, default="manual")
    snapshot_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("story_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    #: The version's name, for a reading taken with a named snapshot.
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    #: The shape of ``data`` (``services/numbers_reading.READING_VERSION``).
    version: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)

    story: Mapped["Story"] = relationship("Story", back_populates="numbers_readings")
