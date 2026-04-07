import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class DialogueBlock(Base):
    """A unit of attributed dialogue extracted from scene prose.

    Captured from two patterns:
      - Explicit:  @Maya: "I don't think this will work."
      - Inferred:  "I don't think this will work," @Maya said.
    """

    __tablename__ = "dialogue_blocks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scene_id: Mapped[str] = mapped_column(String, ForeignKey("structure_nodes.id"), nullable=False)
    character_id: Mapped[str | None] = mapped_column(String, ForeignKey("characters.id"), nullable=True)

    # The dialogue text (without surrounding quotes or attribution markup)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Raw source text as it appeared in the prose (for display in review panels)
    raw_text: Mapped[str] = mapped_column(Text, default="")

    # Position within the scene content for ordering and display
    paragraph_index: Mapped[int] = mapped_column(Integer, default=0)
    position_in_paragraph: Mapped[int] = mapped_column(Integer, default=0)

    # Attribution
    # "explicit"    — @Name: "..." syntax used
    # "inferred"    — @mention proximity used
    # "alternating" — inferred by alternation in rapid exchanges
    # "manual"      — author corrected via UI
    # "unattributed" — no speaker could be determined
    attribution_method: Mapped[str] = mapped_column(String, default="unattributed")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0-1.0

    # Raw speaker name from markup (may not match any Character.name)
    speaker_name: Mapped[str] = mapped_column(String, default="")

    # Optional author note on what the character means vs what they say
    subtext: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    character: Mapped["Character | None"] = relationship("Character", foreign_keys=[character_id])
