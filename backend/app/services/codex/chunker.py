"""
Cutting the story into passages small enough to embed (doc 07 §4).

A chunk is the unit the retriever quotes back, so the seams matter. Prose is split on
paragraph boundaries and packed up to a target size — never mid-sentence, because half a
line of dialogue retrieved out of context is worse than not retrieving it. Lorebook rows
are short and self-contained and stay whole: a character's profile split in two would let
"afraid of the water" arrive without the name it belongs to.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from ..text_utils import html_to_paragraphs

#: Characters per token. The gateway's budgeting uses the same rough number; chunk sizes
#: only have to be consistent with each other, not exact.
CHARS_PER_TOKEN = 4

#: Target passage size. Big enough to hold a beat of a scene, small enough that a hit is
#: a place in the story rather than "somewhere in this chapter".
TARGET_TOKENS = 300

#: A paragraph longer than this is split on sentences rather than left as one huge chunk.
MAX_TOKENS = 500

#: Below this a passage is not worth an embedding call — a one-word paragraph retrieves
#: badly and dilutes the index.
MIN_CHARS = 24


def estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


@dataclass(frozen=True)
class Chunk:
    """One passage, ready to embed. `index` is its order within its node."""

    index: int
    text: str
    token_count: int

    @property
    def text_hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()[:32]


def _split_sentences(text: str) -> list[str]:
    """Crude sentence split, used only to break up an oversized paragraph."""
    out: list[str] = []
    buf: list[str] = []
    for part in text.replace("? ", "?\x00").replace("! ", "!\x00").replace(". ", ".\x00").split("\x00"):
        buf.append(part)
        if estimate_tokens("".join(buf)) >= TARGET_TOKENS:
            out.append(" ".join(s.strip() for s in buf).strip())
            buf = []
    if buf:
        out.append(" ".join(s.strip() for s in buf).strip())
    return [s for s in out if s]


def pack_paragraphs(paragraphs: list[str], target_tokens: int = TARGET_TOKENS) -> list[str]:
    """
    Greedily fill passages up to `target_tokens`, never splitting a paragraph that fits.

    Overshooting the target slightly is preferred to cutting a paragraph in half: the
    budget is a guide, and a whole thought retrieves better than a tidy fragment.
    """
    passages: list[str] = []
    buf: list[str] = []
    size = 0
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        pieces = _split_sentences(para) if estimate_tokens(para) > MAX_TOKENS else [para]
        for piece in pieces:
            cost = estimate_tokens(piece)
            if buf and size + cost > target_tokens:
                passages.append("\n\n".join(buf))
                buf, size = [], 0
            buf.append(piece)
            size += cost
    if buf:
        passages.append("\n\n".join(buf))
    return passages


def chunk_prose(html: str, target_tokens: int = TARGET_TOKENS) -> list[Chunk]:
    """Scene or chapter content (TipTap HTML) as ordered passages."""
    passages = pack_paragraphs(html_to_paragraphs(html or ""), target_tokens)
    return [
        Chunk(index=i, text=p, token_count=estimate_tokens(p))
        for i, p in enumerate(x for x in passages if len(x) >= MIN_CHARS)
    ]


def chunk_entry(label: str | None, *body: str | None, target_tokens: int = TARGET_TOKENS) -> list[Chunk]:
    """
    A Lorebook row: its heading and its fields, joined and kept whole where it fits.

    A heading with nothing under it is not a passage. An empty location stub would
    otherwise enter the index as the single word "Pier" and match every question about
    piers perfectly, outranking the scenes that actually happen there — a name is already
    in the graph as a node label, and does not need to be in the index as well.

    The heading rides on the first passage rather than being packed like a paragraph, for
    the same reason: on a long profile the packer would flush it on its own, and "Elena"
    alone is exactly the chunk we are trying not to make. Later passages go without it, so
    a repeated name does not pull every vector of the entry toward each other.
    """
    filled = [p.strip() for p in body if p and p.strip()]
    if not filled:
        return []
    passages = pack_paragraphs(filled, target_tokens)
    head = label.strip() if label and label.strip() else ""
    if head:
        passages[0] = f"{head}\n\n{passages[0]}"
    return [Chunk(index=i, text=p, token_count=estimate_tokens(p)) for i, p in enumerate(passages)]
