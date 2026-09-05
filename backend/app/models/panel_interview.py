import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story


class PanelInterview(Base):
    __tablename__ = "panel_interviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, default="")
    character_ids: Mapped[list] = mapped_column(JSON, default=list)
    # messages format: [{"role": "user"|"character", "content": str, "timestamp": str,
    #                    "character_id": str|None, "character_name": str|None}]
    messages: Mapped[list] = mapped_column(JSON, default=list)
    # settings format: {"max_rounds": int}
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="panel_interviews")
