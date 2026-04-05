import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class DiscoveredElement(Base):
    __tablename__ = "discovered_elements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False
    )
    # "character" | "setting" | "relationship" | "theme" | "object"
    element_type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.7)

    # Provenance — which scene and what passage triggered this
    source_node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("structure_nodes.id", ondelete="SET NULL"), nullable=True
    )
    source_excerpt: Mapped[str] = mapped_column(Text, default="")

    # Approval workflow
    # "pending" | "approved" | "rejected"
    status: Mapped[str] = mapped_column(String, default="pending", server_default="pending")
    # If approved and promoted to a real entity, record what was created
    merged_to_type: Mapped[str | None] = mapped_column(String, nullable=True)
    merged_to_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    story: Mapped["Story"] = relationship("Story", back_populates="discovered_elements")
    source_node: Mapped["StructureNode | None"] = relationship("StructureNode")
