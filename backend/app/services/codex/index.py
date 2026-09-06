"""
Building and refreshing the semantic index over a story (doc 07 §4).

The index is derived data, and this module treats it that way: it can be thrown away and
rebuilt at any time, and rebuilding is cheap because a passage that has not changed keeps
the vector it already had. Only new or edited text costs an embedding call, so a reindex
after fixing a typo in one scene is a handful of requests, not a thousand.

Chunks are attached to Codex nodes, so the index is only ever as complete as the graph.
A story that has never been synced has nothing to index — which is the honest answer, not
a failure.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.codex import CodexChunk, CodexNode
from ...models.culture import Culture
from ...models.location import Location
from ...models.plot_thread import PlotThread
from ...models.structure import StructureNode
from ...models.twist import Twist
from ...models.world_system import WorldSystem
from .chunker import Chunk, chunk_entry, chunk_prose
from .embeddings import embed_texts, search_backend

logger = logging.getLogger(__name__)

#: Node kinds that carry text worth retrieving. A node with nothing but a name — an empty
#: location stub — produces no chunks and simply is not in the index.
INDEXED_KINDS = ("scene", "character", "location", "thread", "twist", "fact", "culture", "system")


@dataclass
class IndexReport:
    chunks: int = 0  # passages in the index when this finished
    embedded: int = 0  # vectors computed on this run
    reused: int = 0  # passages whose text was unchanged, vector kept
    removed: int = 0  # chunks whose source text is gone
    model: str = ""
    errors: list[str] = field(default_factory=list)


def _rows_by_id(db: Session, model, story_id: str) -> dict:
    return {r.id: r for r in db.query(model).filter(model.story_id == story_id)}


def _character_chunks(c: Character) -> list[Chunk]:
    return chunk_entry(
        f"{c.name} — {c.role}".strip(" —"),
        c.personality,
        c.motivation,
        c.background,
        c.appearance,
        c.arc_notes,
        c.narrative_intent,
        c.snowflake_summary,
    )


def _location_chunks(loc: Location) -> list[Chunk]:
    return chunk_entry(loc.name, loc.description, loc.atmosphere, loc.history, loc.significance, loc.terrain)


def _twist_chunks(t: Twist) -> list[Chunk]:
    return chunk_entry(t.name, t.the_truth, t.the_misdirection)


def _chunks_for_node(node: CodexNode, sources: dict[str, dict]) -> list[Chunk]:
    """The passages one node contributes, or nothing when it has no prose of its own."""
    row = sources.get(node.kind, {}).get(node.ref_id)
    if node.kind == "scene":
        return chunk_prose(getattr(row, "content", "") or "") if row is not None else []
    if row is None:
        # Facts live on the node itself: they are derived from events, not a table of prose.
        return chunk_entry(node.label, node.summary) if node.kind == "fact" else []
    if node.kind == "character":
        return _character_chunks(row)
    if node.kind == "location":
        return _location_chunks(row)
    if node.kind == "twist":
        return _twist_chunks(row)
    return chunk_entry(getattr(row, "name", ""), getattr(row, "description", ""))


def build_chunks(story_id: str, db: Session) -> IndexReport:
    """
    Recompute every passage for a story, keeping the vectors of text that did not change.

    Deterministic and safe to re-run: it is the same walk over the same rows every time.
    """
    report = IndexReport()
    nodes = db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind.in_(INDEXED_KINDS)).all()
    if not nodes:
        return report

    sources = {
        "scene": {r.id: r for r in db.query(StructureNode).filter(StructureNode.story_id == story_id)},
        "character": _rows_by_id(db, Character, story_id),
        "location": _rows_by_id(db, Location, story_id),
        "thread": _rows_by_id(db, PlotThread, story_id),
        "twist": _rows_by_id(db, Twist, story_id),
        "culture": _rows_by_id(db, Culture, story_id),
        "system": _rows_by_id(db, WorldSystem, story_id),
    }

    existing: dict[tuple[str, int], CodexChunk] = {
        (c.node_id, c.chunk_index): c for c in db.query(CodexChunk).filter(CodexChunk.story_id == story_id).all()
    }
    keep: set[tuple[str, int]] = set()

    for node in nodes:
        for chunk in _chunks_for_node(node, sources):
            key = (node.id, chunk.index)
            keep.add(key)
            row = existing.get(key)
            if row is None:
                db.add(
                    CodexChunk(
                        story_id=story_id,
                        node_id=node.id,
                        chunk_index=chunk.index,
                        text=chunk.text,
                        token_count=chunk.token_count,
                        text_hash=chunk.text_hash,
                    )
                )
                report.chunks += 1
            elif row.text_hash == chunk.text_hash:
                report.reused += 1
                report.chunks += 1
            else:
                # The words changed, so the old vector no longer describes them.
                row.text = chunk.text
                row.token_count = chunk.token_count
                row.text_hash = chunk.text_hash
                row.embedding = None
                report.chunks += 1

    for key, row in existing.items():
        if key not in keep:
            db.delete(row)
            report.removed += 1
    db.commit()
    return report


def pending_chunks(story_id: str, db: Session, model: str) -> list[CodexChunk]:
    """Passages with no vector, or a vector made by a different model."""
    return (
        db.query(CodexChunk)
        .filter(
            CodexChunk.story_id == story_id,
            (CodexChunk.embedding.is_(None)) | (CodexChunk.embed_model != model),
        )
        .order_by(CodexChunk.node_id, CodexChunk.chunk_index)
        .all()
    )


async def embed_pending(
    story_id: str,
    db: Session,
    *,
    model: str,
    base_url: str | None = None,
    batch: int = 16,
    should_stop=None,
    on_progress=None,
) -> IndexReport:
    """
    Embed everything that needs it, a batch at a time, committing as it goes.

    Committing per batch is what makes this interruptible: stop it halfway and the vectors
    already computed are kept, so resuming costs only what is left.
    """
    from .embeddings import pack

    report = IndexReport(model=model)
    todo = pending_chunks(story_id, db, model)
    total = len(todo)
    for start in range(0, total, batch):
        if should_stop is not None and should_stop():
            break
        group = todo[start : start + batch]
        try:
            vectors = await embed_texts([c.text for c in group], model=model, base_url=base_url)
        except Exception as exc:
            report.errors.append(str(exc)[:200])
            logger.warning("Codex embed batch failed: %s", exc)
            break
        for chunk, vector in zip(group, vectors, strict=True):
            chunk.embedding = pack(vector)
            chunk.embed_model = model
            chunk.dim = len(vector)
            report.embedded += 1
        db.commit()
        if on_progress is not None:
            on_progress(min(start + batch, total), total)
    return report


def index_stats(story_id: str, db: Session) -> dict:
    """What the Settings page shows: how much is indexed, with what, and how big it is."""
    rows = db.query(CodexChunk).filter(CodexChunk.story_id == story_id).all()
    embedded = [r for r in rows if r.embedding]
    models = sorted({r.embed_model for r in embedded if r.embed_model})
    return {
        "chunks": len(rows),
        "embedded": len(embedded),
        "pending": len(rows) - len(embedded),
        "tokens": sum(r.token_count for r in rows),
        "bytes": sum(len(r.embedding or b"") for r in embedded),
        "dim": embedded[0].dim if embedded else 0,
        "models": models,
        "backend": search_backend(),
    }
