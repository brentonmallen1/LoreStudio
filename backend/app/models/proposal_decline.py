import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class ProposalDecline(Base):
    """The author said "not this" to something the app proposed (doc 12 P5).

    Most proposals have a row of their own to mark (a stub place, a discovery, a suggested
    relationship); these are for the ones that are recomputed from the prose, which have
    nothing to mark: a name a scan found, dialogue without a speaker. Kept by fingerprint,
    with the scene's hash where there is a scene, so new text can propose again.
    """

    __tablename__ = "proposal_declines"
    __table_args__ = (UniqueConstraint("story_id", "fingerprint", name="uq_proposal_decline"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    node_content_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    declined_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    story: Mapped["Story"] = relationship("Story", back_populates="proposal_declines")
