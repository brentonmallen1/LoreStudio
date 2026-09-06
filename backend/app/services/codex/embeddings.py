"""
Vectors for the Codex index: making them, storing them, searching them (doc 07 §4).

Two deliberate choices live here. Embeddings go through the same Ollama the rest of the
app talks to, so nothing leaves the machine. And the search is exact — every chunk of the
candidate set is compared, no approximate index — because a story is thousands of
passages, not millions, and an exact answer that takes four milliseconds beats an
approximate one that needs tuning.

sqlite-vec does the distance arithmetic when it loaded; otherwise the same arithmetic runs
in Python. The results are identical, and `search_backend()` says which ran, so the
Settings page can report what is actually happening rather than what was hoped for.
"""

from __future__ import annotations

import logging
import struct
from dataclasses import dataclass

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from ... import database
from ...models.codex import CodexChunk
from ...models.user import User
from ...services.llm.ollama import ollama_provider

logger = logging.getLogger(__name__)

#: Default embedding model. Small, fast, made for retrieval, and one `ollama pull` away.
DEFAULT_EMBED_MODEL = "nomic-embed-text"

#: Passages per /api/embed call. Ollama batches happily; this keeps one failure from
#: costing a whole reindex.
BATCH_SIZE = 32


def pack(vector: list[float]) -> bytes:
    """Little-endian float32, the layout sqlite-vec reads."""
    return struct.pack(f"<{len(vector)}f", *vector)


def unpack(blob: bytes) -> list[float]:
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def search_backend() -> str:
    """ "sqlite-vec" or "python" — which one will answer the next query."""
    return "sqlite-vec" if database.VEC_LOADED else "python"


def embed_model_for(user: User | None) -> str:
    """The embedding model this user chose, or the default."""
    return ((user.settings or {}).get("codex", {}) if user else {}).get("embed_model") or DEFAULT_EMBED_MODEL


def embed_base_url_for(user: User | None) -> str | None:
    """Embeddings follow the user's Ollama host, since that is where their models are."""
    return ((user.settings or {}).get("llm", {}) if user else {}).get("ollama_url")


async def embed_texts(texts: list[str], *, model: str, base_url: str | None = None) -> list[list[float]]:
    """Embed passages in batches, preserving order."""
    out: list[list[float]] = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        out.extend(await ollama_provider.embed(batch, model=model, base_url=base_url))
    return out


@dataclass
class Hit:
    """One retrieved passage and why it scored where it did."""

    chunk_id: str
    node_id: str
    text: str
    token_count: int
    score: float


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return 0.0 if not na or not nb else dot / (na * nb)


def _python_search(
    db: Session, story_id: str, query: list[float], node_ids: list[str] | None, limit: int, model: str
) -> list[Hit]:
    q = db.query(CodexChunk).filter(
        CodexChunk.story_id == story_id,
        CodexChunk.embedding.isnot(None),
        CodexChunk.embed_model == model,
    )
    if node_ids is not None:
        q = q.filter(CodexChunk.node_id.in_(node_ids))
    hits = [
        Hit(
            chunk_id=row.id,
            node_id=row.node_id,
            text=row.text,
            token_count=row.token_count,
            score=_cosine(query, unpack(row.embedding or b"")),
        )
        for row in q
    ]
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:limit]


def _vec_search(
    db: Session, story_id: str, query: list[float], node_ids: list[str] | None, limit: int, model: str
) -> list[Hit]:
    clause = ""
    params: dict = {"story_id": story_id, "q": pack(query), "limit": limit, "model": model}
    if node_ids is not None:
        if not node_ids:
            return []
        keys = [f"n{i}" for i in range(len(node_ids))]
        clause = f" AND node_id IN ({', '.join(':' + k for k in keys)})"
        params.update(dict(zip(keys, node_ids, strict=True)))
    rows = db.execute(
        sql_text(
            "SELECT id, node_id, text, token_count, vec_distance_cosine(embedding, :q) AS distance "
            "FROM codex_chunks "
            "WHERE story_id = :story_id AND embedding IS NOT NULL AND embed_model = :model"
            f"{clause} ORDER BY distance LIMIT :limit"
        ),
        params,
    ).all()
    # sqlite-vec returns a cosine *distance*; the rest of the system talks in similarity.
    return [Hit(chunk_id=r[0], node_id=r[1], text=r[2], token_count=r[3], score=1.0 - r[4]) for r in rows]


def search(
    db: Session,
    story_id: str,
    query: list[float],
    *,
    node_ids: list[str] | None = None,
    limit: int = 10,
    model: str = DEFAULT_EMBED_MODEL,
) -> list[Hit]:
    """
    Nearest passages to `query`, optionally restricted to a set of nodes.

    `node_ids=None` searches the whole story; a list restricts to what a graph walk turned
    up, which is the normal case — retrieval is meant to rank what the graph already
    decided was relevant, not to go looking on its own.
    """
    if not query:
        return []
    if database.VEC_LOADED:
        try:
            return _vec_search(db, story_id, query, node_ids, limit, model)
        except Exception:  # pragma: no cover - only when the extension misbehaves
            logger.warning("sqlite-vec search failed; falling back to Python", exc_info=True)
    return _python_search(db, story_id, query, node_ids, limit, model)
