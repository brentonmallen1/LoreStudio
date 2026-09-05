import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class BeatSheet(Base):
    """A story structure framework with named beats at expected positions (percentages)."""

    __tablename__ = "beat_sheets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    # JSON: [{"id": "opening-image", "name": "Opening Image", "position_pct": 1, "description": "..."}]
    beats: Mapped[list] = mapped_column(JSON, default=list)
