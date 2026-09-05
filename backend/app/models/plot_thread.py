import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .story import Story
    from .structure import StructureNode



class PlotThread(Base):
    __tablename__ = "plot_threads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="open")  # open | developing | resolved
    color: Mapped[str] = mapped_column(String, default="#6b7280")
    mice_type: Mapped[str | None] = mapped_column(String, nullable=True)  # milieu | idea | character | event
    opens_at_node_id: Mapped[str | None] = mapped_column(String, nullable=True)
    closes_at_node_id: Mapped[str | None] = mapped_column(String, nullable=True)
    try_fail_cycles: Mapped[list] = mapped_column(JSON, default=list, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="plot_threads")
    appearances: Mapped[list["PlotThreadAppearance"]] = relationship(
        "PlotThreadAppearance", back_populates="thread", cascade="all, delete-orphan"
    )


class PlotThreadAppearance(Base):
    __tablename__ = "plot_thread_appearances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id: Mapped[str] = mapped_column(String, ForeignKey("plot_threads.id"), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    thread: Mapped["PlotThread"] = relationship("PlotThread", back_populates="appearances")
    node: Mapped["StructureNode"] = relationship("StructureNode", back_populates="thread_appearances")
