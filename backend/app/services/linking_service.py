"""
Entity linking service.

Scans scene prose for characters and places named in plain words and proposes making them
mentions: "Eleanor" becomes "@Eleanor", "the lighthouse" becomes "[[the lighthouse]]". The
words stay as written; a mention answers to a name, another name, or a short form only one
character has (services/prose_syntax), so it still finds the entry.

On the text, by the grammar (doc 16): words inside a speaker tag ("…"<Eleanor>) or an
existing mention are never proposed or rewritten, a character is matched by the forms the
prose uses (never "The" of "The Visitor (Calder)"), and a one-word form must be capitalised,
as presence matching has it, so "will" is not Will.
"""

import re
import uuid

from .prose_html import Edit, apply_edits, paragraphs
from .prose_syntax import Known, Lexicon, find_mentions, find_speaker_tags, fold


def _known(characters: list, locations: list) -> Lexicon:
    return Lexicon(
        [Known("character", c.name, tuple(getattr(c, "aliases", None) or ())) for c in characters if c.name]
        + [Known("place", loc.name, tuple(getattr(loc, "aliases", None) or ())) for loc in locations if loc.name]
    )


def _taken(text: str, lex: Lexicon) -> list[tuple[int, int]]:
    """Stretches already syntax: mentions and speaker tags."""
    return [(m.start, m.end) for m in find_mentions(text, lex)] + [
        (t.tag_start, t.end) for t in find_speaker_tags(text)
    ]


def _pattern(words: str) -> re.Pattern[str]:
    # A one-word form must be capitalised as written; a longer one is matched in any case.
    flags = 0 if " " not in words else re.IGNORECASE
    return re.compile(rf"(?<![\w@\[]){re.escape(words)}(?![\w\]])", flags)


def _variants(entity, kind: str, lex: Lexicon) -> list[str]:
    """What the prose may call it, longest first: name, other names and (for a character)
    the short forms only it goes by."""
    names = [entity.name, *(getattr(entity, "aliases", None) or [])]
    if kind == "character":
        names += [f for f, owners in lex.forms.items() if owners == {entity.name}]
        # Forms are folded; recover the written casing from the name they came from.
        names = [_cased(n, entity) for n in names]
    return sorted({n for n in names if n and n.strip()}, key=len, reverse=True)


def _cased(form: str, entity) -> str:
    for n in [entity.name, *(getattr(entity, "aliases", None) or [])]:
        i = n.casefold().find(form)
        if i >= 0 and fold(n[i : i + len(form)]) == form:
            return n[i : i + len(form)]
    return form


def _excerpt(text: str, start: int, end: int) -> str:
    a, b = max(0, start - 30), min(len(text), end + 30)
    return ("…" if a > 0 else "") + text[a:b] + ("…" if b < len(text) else "")


def _build_proposals(paras: list[str], characters: list, locations: list) -> list[dict]:
    lex = _known(characters, locations)
    mentioned = {m.name for p in paras for m in find_mentions(p, lex) if m.name}
    proposals: list[dict] = []
    for kind, entities in (("character", characters), ("location", locations)):
        for e in entities:
            if not e.name or not e.name.strip() or e.name in mentioned:
                continue
            found = _first_unlinked(paras, _variants(e, kind, lex), lex)
            if not found:
                continue
            offset, text, start, end = found
            proposals.append(
                {
                    "id": str(uuid.uuid4()),
                    "entity_type": kind,
                    "entity_id": e.id,
                    "entity_name": e.name,
                    "matched_text": text[start:end],
                    "text_start": offset + start,
                    "confidence": 1.0 if fold(text[start:end]) == fold(e.name) else 0.75,
                    "source_excerpt": _excerpt(text, start, end),
                }
            )
    proposals.sort(key=lambda p: p["text_start"])
    return proposals


def _first_unlinked(paras: list[str], variants: list[str], lex: Lexicon):
    offset = 0
    for text in paras:
        taken = _taken(text, lex)
        best = None
        for v in variants:
            for m in _pattern(v).finditer(text):
                if not any(m.start() < b and a < m.end() for a, b in taken):
                    if best is None or m.start() < best[0]:
                        best = (m.start(), m.end())
                    break
        if best:
            return offset, text, best[0], best[1]
        offset += len(text) + 1
    return None


def suggest_entity_links_preloaded(scene_content: str, characters: list, locations: list) -> list[dict]:
    """Scan a scene using pre-loaded entity lists (use in loops to avoid per-scene queries)."""
    return _build_proposals([p.text for p in paragraphs(scene_content)], characters, locations)


def suggest_entity_links(scene_content: str, story_id: str, db) -> list[dict]:
    """Scan a scene for characters and places named in plain words."""
    from ..models.character import Character
    from ..models.location import Location

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    locations = db.query(Location).filter(Location.story_id == story_id).all()
    return suggest_entity_links_preloaded(scene_content, characters, locations)


def apply_entity_links(scene_content: str, links: list[dict]) -> str:
    """
    Make each approved proposal a mention: the first plain use of its `matched_text` becomes
    `@matched` or `[[matched]]`, keeping the author's words. Never inside a speaker tag or an
    existing mention, never across markup.
    """
    if not links:
        return scene_content
    paras = paragraphs(scene_content)
    lex = Lexicon([])
    used: list[tuple[int, int, int]] = []
    edits: list[Edit] = []
    for link in sorted(links, key=lambda link: len(link["matched_text"]), reverse=True):
        words = link["matched_text"]
        for i, p in enumerate(paras):
            taken = _taken(p.text, lex) + [(a, b) for j, a, b in used if j == i]
            hit = next(
                (
                    m
                    for m in _pattern(words).finditer(p.text)
                    if not any(m.start() < b and a < m.end() for a, b in taken)
                ),
                None,
            )
            if hit:
                used.append((i, hit.start(), hit.end()))
                syntax = f"@{hit.group(0)}" if link["entity_type"] == "character" else f"[[{hit.group(0)}]]"
                edits.append(Edit(p, hit.start(), hit.end(), syntax))
                break
    return apply_edits(scene_content, edits)[0] if edits else scene_content
