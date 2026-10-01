import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class FindingDismissal(Base):
    """The author said "it's intended" about one finding (doc 12 D4).

    Findings are computed, so there is nothing to mark; the dismissal is kept by the
    finding's fingerprint instead. When the finding sits in a scene, the scene's content
    hash is kept too: once the scene changes, the dismissal lapses and the finding may
    come back, because what was intended about the old text says nothing about the new.
    """

    __tablename__ = "finding_dismissals"
    __table_args__ = (UniqueConstraint("story_id", "fingerprint", name="uq_finding_dismissal"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    node_content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    dismissed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    story: Mapped["Story"] = relationship("Story", back_populates="finding_dismissals")
