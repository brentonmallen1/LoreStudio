import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .snapshot import UserBackupDefaults
    from .story import Story


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    #: The scratch pad (doc 15 N4): one page of HTML, belonging to no story.
    scratch_pad: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    stories: Mapped[list["Story"]] = relationship("Story", back_populates="user", cascade="all, delete-orphan")
    backup_defaults: Mapped["UserBackupDefaults | None"] = relationship(
        "UserBackupDefaults", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
