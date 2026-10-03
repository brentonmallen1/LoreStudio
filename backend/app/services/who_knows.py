"""
"Characters who know" holds character ids (doc 18, B1).

The reader-knowledge form and the scan wrote names, the seed and the Codex used ids, so what a
writer typed never reached interviews or the knowledge graph. Names are resolved the way a
speaker tag is (a name, an other name, or a short form only one character goes by); anything
that names nobody is dropped rather than kept as a string nothing can match.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.character import Character
from .prose_syntax import Known, Lexicon


def character_ids(story_id: str, values: list[str], db: Session) -> list[str]:
    chars = db.query(Character).filter(Character.story_id == story_id).all()
    by_id = {c.id for c in chars}
    by_name = {c.name: c.id for c in chars}
    lex = Lexicon([Known("character", c.name, tuple(c.aliases or ())) for c in chars if c.name])
    out: list[str] = []
    for raw in values or []:
        value = str(raw).strip()
        cid = value if value in by_id else by_name.get(lex.speaker(value) or "")
        if cid and cid not in out:
            out.append(cid)
    return out
