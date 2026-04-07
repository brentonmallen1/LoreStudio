"""
Dialogue extraction service.

Parses scene prose (TipTap HTML) to identify attributed dialogue blocks.

Two attribution methods:
  1. Explicit: "dialogue text"<Name>  — speaker suffix attached directly to quote
  2. Inferred: "dialogue text" ... @Name (proximity-based, with alternation)

The HTML is stripped to plain text per paragraph before regex parsing.
"""

import re
import uuid
from datetime import datetime, timezone
from html.parser import HTMLParser

from sqlalchemy.orm import Session

from ..models.dialogue import DialogueBlock
from ..models.character import Character


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Explicit: "..."<Name> — speaker suffix attached directly to the closing quote.
# Multi-word names are allowed (e.g. "Hello."<Lady Ashford>).
# Captures: (dialogue_content, speaker_name)
_EXPLICIT_RE = re.compile(
    r'\u201c([^\u201d]+)\u201d<([^>]+)>'   # smart quotes "…"<Name>
    r'|"([^"]+)"<([^>]+)>',                 # straight quotes "..."<Name>
    re.UNICODE,
)

# Standalone quotes with no <Name> suffix — candidates for inference/unattributed.
# Negative lookahead (?!<) excludes quotes already captured by _EXPLICIT_RE.
_STANDALONE_QUOTE_RE = re.compile(
    r'\u201c([^\u201d]+)\u201d(?!<)|(?:^|\s)"([^"]+)"(?!<)',
    re.UNICODE,
)

# Any @mention in a line (for proximity/alternation inference).
# Deliberately excludes \s so that @Maya followed by prose words isn't consumed.
# Multi-word names (e.g. Lady Ashford) require explicit @Name: "..." syntax.
_MENTION_RE = re.compile(r'@([\w][\w\'-]{0,49})', re.UNICODE)


# ---------------------------------------------------------------------------
# HTML → plain text
# ---------------------------------------------------------------------------

class _TextExtractor(HTMLParser):
    """Extract paragraph-level plain text from TipTap HTML."""

    def __init__(self):
        super().__init__()
        self._paragraphs: list[str] = []
        self._current: list[str] = []
        self._block_tags = {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"}

    def handle_starttag(self, tag, attrs):
        if tag in self._block_tags and self._current:
            self._flush()

    def handle_endtag(self, tag):
        if tag in self._block_tags:
            self._flush()

    def handle_data(self, data):
        self._current.append(data)

    def handle_entityref(self, name):
        import html as html_module
        self._current.append(html_module.unescape(f"&{name};"))

    def handle_charref(self, name):
        import html as html_module
        self._current.append(html_module.unescape(f"&#{name};"))

    def _flush(self):
        text = "".join(self._current).strip()
        if text:
            self._paragraphs.append(text)
        self._current = []

    def get_paragraphs(self) -> list[str]:
        self._flush()
        return self._paragraphs


def _html_to_paragraphs(html: str) -> list[str]:
    extractor = _TextExtractor()
    extractor.feed(html)
    return extractor.get_paragraphs()


# ---------------------------------------------------------------------------
# Per-paragraph extraction
# ---------------------------------------------------------------------------

def _extract_from_paragraph(
    text: str,
    para_index: int,
    known_names: set[str],
) -> list[dict]:
    """Return a list of raw dialogue dicts extracted from one paragraph."""
    results = []

    # Pass 1: explicit attribution ("..."<Name>)
    explicit_matches = set()
    for m in _EXPLICIT_RE.finditer(text):
        if m.group(1):
            content, speaker = m.group(1).strip(), m.group(2).strip()
        else:
            content, speaker = m.group(3).strip(), m.group(4).strip()
        results.append({
            "speaker_name": speaker,
            "content": content.strip(),
            "raw_text": m.group(0),
            "paragraph_index": para_index,
            "position_in_paragraph": m.start(),
            "attribution_method": "explicit",
            "confidence": 1.0,
        })
        explicit_matches.add(m.start())

    if results:
        # If we found explicit markers, don't try inference on this paragraph
        return results

    # Pass 2: inferred — build candidate quote list and nearby @mentions
    # Collect all quotes with positions
    quotes: list[tuple[int, str]] = []  # (start_pos, content)
    for m in _STANDALONE_QUOTE_RE.finditer(text):
        content = (m.group(1) or m.group(2) or "").strip()
        if content and len(content) >= 2:
            quotes.append((m.start(), content))

    if not quotes:
        return results

    # Find all @mentions with positions
    mentions: list[tuple[int, str]] = [
        (m.start(), m.group(1).strip()) for m in _MENTION_RE.finditer(text)
    ]

    for q_pos, q_content in quotes:
        best_speaker = None
        best_dist = 999
        best_method = "unattributed"

        for m_pos, m_name in mentions:
            dist = abs(q_pos - m_pos)
            if dist < best_dist and dist <= 150:
                best_dist = dist
                best_speaker = m_name
                best_method = "inferred"

        confidence = max(0.0, 1.0 - (best_dist / 150)) if best_speaker else 0.0

        results.append({
            "speaker_name": best_speaker or "",
            "content": q_content,
            "raw_text": f'"{q_content}"',
            "paragraph_index": para_index,
            "position_in_paragraph": q_pos,
            "attribution_method": best_method,
            "confidence": round(confidence, 2),
        })

    return results


def _apply_alternation(raw_blocks: list[dict]) -> list[dict]:
    """
    For runs of consecutive paragraphs with no inferred/explicit speaker,
    try alternating between the last two established speakers.
    """
    last_two: list[str] = []  # most recent speakers (up to 2)
    for block in raw_blocks:
        method = block["attribution_method"]
        if method in ("explicit", "inferred") and block["speaker_name"]:
            name = block["speaker_name"]
            if not last_two or last_two[-1] != name:
                if len(last_two) == 2:
                    last_two.pop(0)
                last_two.append(name)
        elif method == "unattributed" and len(last_two) == 2:
            # Assign the "other" speaker
            prev = block.get("_prev_speaker")
            if prev and prev in last_two:
                other = last_two[0] if last_two[1] == prev else last_two[1]
                block["speaker_name"] = other
                block["attribution_method"] = "alternating"
                block["confidence"] = 0.6

        # Track previous speaker for next iteration
        if block["speaker_name"]:
            block["_prev_speaker"] = block["speaker_name"]

    # Clean internal key
    for block in raw_blocks:
        block.pop("_prev_speaker", None)

    return raw_blocks


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_dialogue(scene_content: str, para_index_offset: int = 0) -> list[dict]:
    """Parse TipTap HTML and return raw dialogue block dicts (unsaved)."""
    paragraphs = _html_to_paragraphs(scene_content)
    all_blocks = []
    for i, para in enumerate(paragraphs):
        blocks = _extract_from_paragraph(para, i + para_index_offset, known_names=set())
        all_blocks.extend(blocks)
    _apply_alternation(all_blocks)
    return all_blocks


def sync_dialogue_blocks(
    scene_id: str,
    scene_content: str,
    story_id: str,
    db: Session,
) -> list[DialogueBlock]:
    """Re-extract dialogue from scene content and sync to the database.

    Deletes existing auto-extracted blocks (explicit/inferred/alternating/unattributed)
    and recreates them. Manually corrected blocks (attribution_method='manual') are
    preserved and merged with the new extraction by content match.
    """
    # Load manual blocks before wiping
    manual_blocks: list[DialogueBlock] = (
        db.query(DialogueBlock)
        .filter(
            DialogueBlock.scene_id == scene_id,
            DialogueBlock.attribution_method == "manual",
        )
        .all()
    )
    manual_by_content = {b.content: b for b in manual_blocks}

    # Delete all auto-extracted blocks
    db.query(DialogueBlock).filter(
        DialogueBlock.scene_id == scene_id,
        DialogueBlock.attribution_method != "manual",
    ).delete(synchronize_session=False)

    raw_blocks = extract_dialogue(scene_content)

    # Resolve character_ids from speaker names
    speaker_names = {b["speaker_name"] for b in raw_blocks if b["speaker_name"]}
    characters = (
        db.query(Character)
        .filter(Character.story_id == story_id, Character.name.in_(speaker_names))
        .all()
        if speaker_names
        else []
    )
    char_by_name = {c.name.lower(): c for c in characters}

    now = datetime.now(timezone.utc)
    saved: list[DialogueBlock] = []

    for raw in raw_blocks:
        content = raw["content"]

        # If a manual override exists for this content, keep it
        if content in manual_by_content:
            saved.append(manual_by_content[content])
            continue

        speaker_name = raw["speaker_name"]
        char = char_by_name.get(speaker_name.lower()) if speaker_name else None

        block = DialogueBlock(
            id=str(uuid.uuid4()),
            scene_id=scene_id,
            character_id=char.id if char else None,
            content=content,
            raw_text=raw["raw_text"],
            paragraph_index=raw["paragraph_index"],
            position_in_paragraph=raw["position_in_paragraph"],
            attribution_method=raw["attribution_method"],
            confidence=raw["confidence"],
            speaker_name=speaker_name,
            created_at=now,
            updated_at=now,
        )
        db.add(block)
        saved.append(block)

    db.commit()
    return saved


def get_dialogue_stats(story_id: str, db: Session) -> dict:
    """Aggregate dialogue stats across a story for the Health dashboard."""
    from ..models.structure import StructureNode

    # Get all leaf scene IDs for this story
    scene_ids = [
        row.id for row in
        db.query(StructureNode.id).filter(StructureNode.story_id == story_id).all()
    ]
    if not scene_ids:
        return {"total_blocks": 0, "by_character": [], "unattributed": 0}

    blocks = (
        db.query(DialogueBlock)
        .filter(DialogueBlock.scene_id.in_(scene_ids))
        .all()
    )

    total = len(blocks)
    unattributed = sum(1 for b in blocks if b.attribution_method == "unattributed")

    by_char: dict[str, dict] = {}
    for b in blocks:
        key = b.speaker_name or "Unknown"
        if key not in by_char:
            by_char[key] = {
                "speaker_name": key,
                "character_id": b.character_id,
                "line_count": 0,
                "word_count": 0,
            }
        by_char[key]["line_count"] += 1
        by_char[key]["word_count"] += len(b.content.split())

    return {
        "total_blocks": total,
        "unattributed": unattributed,
        "by_character": sorted(by_char.values(), key=lambda x: x["word_count"], reverse=True),
    }


def get_interaction_matrix(story_id: str, db: Session) -> list[dict]:
    """Return pairwise character interaction data (co-presence in scenes)."""
    from ..models.structure import StructureNode
    from collections import defaultdict

    scene_ids = [
        row.id for row in
        db.query(StructureNode.id).filter(StructureNode.story_id == story_id).all()
    ]
    if not scene_ids:
        return []

    blocks = (
        db.query(DialogueBlock)
        .filter(
            DialogueBlock.scene_id.in_(scene_ids),
            DialogueBlock.character_id.isnot(None),
        )
        .all()
    )

    # Build scene → speaker set mapping
    scene_speakers: dict[str, set[str]] = defaultdict(set)
    for b in blocks:
        scene_speakers[b.scene_id].add(b.character_id)

    # Count pairwise co-occurrences
    pair_counts: dict[tuple[str, str], int] = defaultdict(int)
    for speakers in scene_speakers.values():
        speaker_list = sorted(speakers)
        for i in range(len(speaker_list)):
            for j in range(i + 1, len(speaker_list)):
                pair_counts[(speaker_list[i], speaker_list[j])] += 1

    # Resolve names
    char_ids = {cid for pair in pair_counts for cid in pair}
    characters = db.query(Character).filter(Character.id.in_(char_ids)).all() if char_ids else []
    name_by_id = {c.id: c.name for c in characters}

    return [
        {
            "character_a_id": a,
            "character_a_name": name_by_id.get(a, "Unknown"),
            "character_b_id": b,
            "character_b_name": name_by_id.get(b, "Unknown"),
            "scene_count": count,
        }
        for (a, b), count in sorted(pair_counts.items(), key=lambda x: -x[1])
    ]
