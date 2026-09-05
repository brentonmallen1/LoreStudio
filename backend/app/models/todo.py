import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .story import Story
    from .structure import StructureNode



class StoryTodo(Base):
    __tablename__ = "story_todos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)

    # Optional scene linkage — null means story-level todo
    node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("structure_nodes.id"), nullable=True, index=True
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False)

    # Manual ordering within story
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Character offsets into the scene's prose (nullable — not all todos are anchored)
    doc_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doc_to: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="todos")
    node: Mapped["StructureNode | None"] = relationship(
        "StructureNode", foreign_keys=[node_id], back_populates="todos"
    )
