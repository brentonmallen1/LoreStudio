import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from ..database import Base

if TYPE_CHECKING:
    from .story import Story
    from .structure import StructureNode


class PlotThread(Base):
    __tablename__ = "plot_threads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(String, ForeignKey("stories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    #: Put down for now, by the author. Every other status follows from the scenes (doc 18).
    set_aside: Mapped[bool] = mapped_column(Boolean, default=False)
    #: Palette slot 1..8 (doc 11 P2), painted by each theme; 0 until chosen or assigned.
    color_slot: Mapped[int] = mapped_column(Integer, default=0)
    mice_type: Mapped[str | None] = mapped_column(String, nullable=True)  # milieu | idea | character | event
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    story: Mapped["Story"] = relationship("Story", back_populates="plot_threads")
    appearances: Mapped[list["PlotThreadAppearance"]] = relationship(
        "PlotThreadAppearance", back_populates="thread", cascade="all, delete-orphan"
    )

    # One list of scenes per thread (doc 18 C1): where it opens and closes, and every try
    # along the way, are roles on its appearances.

    def _role_node(self, role: str, last: bool = False) -> str | None:
        nodes = [a.node_id for a in self.appearances if a.role == role]
        if not nodes:
            return None
        if len(nodes) == 1:
            return nodes[0]
        from ..services.structure_order import reading_order

        session = object_session(self)
        order = reading_order(self.story_id, session) if session else {}
        return sorted(nodes, key=lambda n: order.get(n, 0))[-1 if last else 0]

    @property
    def opens_at_node_id(self) -> str | None:
        return self._role_node("opens")

    @property
    def closes_at_node_id(self) -> str | None:
        return self._role_node("closes", last=True)

    @property
    def status(self) -> str:
        """planned (no scenes yet), open, resolved (it has a closing scene) or set_aside."""
        if self.set_aside:
            return "set_aside"
        if any(a.role == "closes" for a in self.appearances):
            return "resolved"
        return "open" if self.appearances else "planned"


class PlotThreadAppearance(Base):
    __tablename__ = "plot_thread_appearances"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id: Mapped[str] = mapped_column(String, ForeignKey("plot_threads.id"), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False, index=True)
    #: What the scene does to the thread: opens | moves | turns | complicates | fails |
    #: fails_worse | costs | succeeds | closes (the last four are a try and how it goes).
    role: Mapped[str] = mapped_column(String, default="moves")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    thread: Mapped["PlotThread"] = relationship("PlotThread", back_populates="appearances")
    node: Mapped["StructureNode"] = relationship("StructureNode", back_populates="thread_appearances")
