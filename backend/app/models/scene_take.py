import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .structure import StructureNode


class SceneTake(Base):
    """One take of a scene: a whole-scene version of its prose (doc 29 D7).

    The take that counts is the scene's prose everywhere (the manuscript, exports, counts,
    checks, the Codex), so its text stays in ``StructureNode.content`` and every reader of the
    prose keeps working. Its row here (``counts``) holds its name and place only; its own
    ``content`` is left empty. The other takes keep their text here until they are deleted.

    A scene with one take has no rows. "Try another version" makes the first two; deleting down
    to one take removes the last row too. ``is_open`` is the take the editor shows, and
    autosave writes to it.
    """

    __tablename__ = "scene_takes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: The writer's name for it ("first draft", "Calder speaks first"); shown after "Take 2 · ".
    label: Mapped[str] = mapped_column(String, default="", server_default="")
    #: Its prose; empty for the take that counts, whose prose is the scene's own.
    content: Mapped[str] = mapped_column(Text, default="", server_default="")
    word_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    counts: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    is_open: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    node: Mapped["StructureNode"] = relationship("StructureNode", back_populates="takes")
