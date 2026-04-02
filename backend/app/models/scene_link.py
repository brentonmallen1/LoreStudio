import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class SceneLink(Base):
    """A typed directional link between two structure nodes (scenes, chapters, etc.)."""

    __tablename__ = "scene_links"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False)
    source_node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False)
    link_type: Mapped[str] = mapped_column(String, nullable=False)  # callback, foreshadowing, parallel, reference
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
