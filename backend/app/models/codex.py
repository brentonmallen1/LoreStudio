import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    or_,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

#: Where a node or edge came from, which decides who may change it and what a rebuild
#: is allowed to throw away (doc 07 §2).
#:   author   — read straight from the Lorebook tables; regenerated on every sync
#:   derived  — computed deterministically (dialogue speakers, mentions, reading order)
#:   override — the author's own correction inside Codex; a sync must never touch it
#:   llm      — a proposal, shown as suggested until the author confirms it
SYNCED_SOURCES = ("author", "derived")


class CodexNode(Base):
    """
    One thing the story knows about: a character, a scene, a location, a fact.

    Mostly a view over tables that already exist — the graph earns its keep by making
    relationships between them queryable, not by holding new content. `ref_table`/`ref_id`
    point back at the row this stands for, so nothing here is a second copy of the truth.
    """

    __tablename__ = "codex_nodes"
    __table_args__ = (
        UniqueConstraint("story_id", "kind", "ref_id", name="uq_codex_node_ref"),
        Index("ix_codex_nodes_story_kind", "story_id", "kind"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )

    #: character | scene | location | thread | twist | fact | culture | system | doc | theme
    kind: Mapped[str] = mapped_column(String, nullable=False)
    ref_table: Mapped[str] = mapped_column(String, default="")
    ref_id: Mapped[str] = mapped_column(String, nullable=False)

    label: Mapped[str] = mapped_column(String, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String, default="author")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


class CodexEdge(Base):
    """
    A typed, directed relationship between two nodes.

    `source` is the whole point: an edge the author wrote is not the same claim as one a
    model proposed, and the graph says which is which rather than blurring them together.
    """

    __tablename__ = "codex_edges"
    __table_args__ = (
        # Per source. A derived "mentioned" edge and the model's proposal that the same
        # character was actually in the room are two different claims, and the review
        # queue needs both — one edge per pair made the proposal collide with the fact.
        UniqueConstraint("story_id", "src_id", "dst_id", "kind", "source", name="uq_codex_edge"),
        Index("ix_codex_edges_src", "src_id", "kind"),
        Index("ix_codex_edges_dst", "dst_id", "kind"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    src_id: Mapped[str] = mapped_column(String, ForeignKey("codex_nodes.id", ondelete="CASCADE"), nullable=False)
    dst_id: Mapped[str] = mapped_column(String, ForeignKey("codex_nodes.id", ondelete="CASCADE"), nullable=False)

    #: rel | pov | present_in | speaks_in | mentions | at | follows | links | advances |
    #: revealed_in | about | knows | established_in
    kind: Mapped[str] = mapped_column(String, nullable=False)
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String, default="author")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    #: When an author accepted a suggestion. Null on an unconfirmed `llm` edge.
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    #: Ordering hint for edges that have one (scene order, clue order).
    position: Mapped[int] = mapped_column(Integer, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


class CodexChunk(Base):
    """
    A passage of the story, small enough to embed and specific enough to cite.

    Chunks are the retrieval unit: the graph decides *which* nodes are relevant, and the
    chunks under those nodes decide which sentences get sent. `node_id` is what makes a
    retrieved passage explainable — "this came from scene 7, which Mara was present in".

    The vector lives in a BLOB of packed float32, not a `vec0` virtual table. Exact search
    over a story's worth of chunks is fast either way, and one ordinary table means the
    index survives on a SQLite build with no extensions loaded (`embeddings.py`).
    """

    __tablename__ = "codex_chunks"
    __table_args__ = (
        UniqueConstraint("node_id", "chunk_index", name="uq_codex_chunk"),
        Index("ix_codex_chunks_story", "story_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    story_id: Mapped[str] = mapped_column(
        String, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String, ForeignKey("codex_nodes.id", ondelete="CASCADE"), nullable=False)

    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text, default="")
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    #: Packed float32, little-endian. Null until the chunk has been embedded, which is how
    #: an interrupted reindex knows where to pick up.
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    #: The embedding model and dimension the vector was made with. A vector from one model
    #: cannot be compared with a vector from another, so both are recorded and a mismatch
    #: means "re-embed", never "compare anyway".
    embed_model: Mapped[str] = mapped_column(String, default="")
    dim: Mapped[int] = mapped_column(Integer, default=0)
    #: Hash of the source text, so an unchanged passage keeps its vector across a reindex.
    text_hash: Mapped[str] = mapped_column(String, default="")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )


def is_settled(edge: CodexEdge) -> bool:
    """
    Whether an edge may count. A model's proposal is a question for the author, not a fact
    about the story: an unconfirmed `llm` edge must never put a character in a room, a fact
    in their head, or a path in a walk. Confirming it in the review queue is what makes it
    count (doc 07 §2).
    """
    return edge.source != "llm" or edge.confirmed_at is not None


def settled_edges():
    """`is_settled` as a query filter."""
    return or_(CodexEdge.source != "llm", CodexEdge.confirmed_at.is_not(None))
