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
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import delete, false
from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.story import Story
from ..models.structure import StructureNode
from .codex.presence import name_forms
from .text_utils import extract_em_blocks as _extract_em_blocks
from .text_utils import html_to_paragraphs as _html_to_paragraphs

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Explicit: "..."<Name> — speaker suffix attached directly to the closing quote.
# Multi-word names are allowed (e.g. "Hello."<Lady Ashford>).
# Captures: (dialogue_content, speaker_name)
_EXPLICIT_RE = re.compile(
    r"\u201c([^\u201d]+)\u201d<([^>]+)>"  # smart quotes "…"<Name>
    r'|"([^"]+)"<([^>]+)>',  # straight quotes "..."<Name>
    re.UNICODE,
)

# Standalone quotes with no <Name> suffix — candidates for inference/unattributed.
# Negative lookahead (?!<) excludes quotes already captured by _EXPLICIT_RE.
_STANDALONE_QUOTE_RE = re.compile(
    r'\u201c([^\u201d]+)\u201d(?!<)|(?:^|\s)"([^"]+)"(?!<)',
    re.UNICODE,
)

# Dialogue tags that name the speaker in plain prose: "…," Eleanor said / said Eleanor /
# Eleanor said, "…". The @mention pass alone left most real prose unattributed — the
# Lighthouse's own "Eleanor said" lines came out as Unknown.
_SPEECH_VERBS = (
    "said|says|asked|asks|replied|answered|whispered|murmured|muttered|called|shouted|cried|"
    "added|continued|began|repeated|admitted|explained|insisted|snapped|told|tells"
)
_TAG_WINDOW = 60


def _case(form: str) -> int:
    # As the Codex matches presence: a one-word name must be capitalised as written ("will"
    # is not Will), a longer one is distinctive enough in any case ("the Visitor said").
    return re.IGNORECASE if " " in form else 0


def _tag_after(tail: str, forms: list[str]) -> str | None:
    """The speaker named by a tag right after a quote: '"…," Eleanor said' or 'said Eleanor'."""
    for form in forms:
        f = re.escape(form)
        pattern = rf"^[\s,.!?\u2014-]*(?:{f}\s+(?:{_SPEECH_VERBS})|(?:{_SPEECH_VERBS})\s+{f})\b"
        if re.match(pattern, tail, _case(form)):
            return form
    return None


def _tag_before(head: str, forms: list[str]) -> str | None:
    """The speaker named by a tag right before a quote: 'Eleanor said, "…"'."""
    for form in forms:
        if re.search(rf"\b{re.escape(form)}\s+(?:{_SPEECH_VERBS})\s*[,:]?\s*$", head, _case(form)):
            return form
    return None


# Any @mention in a line (for proximity/alternation inference).
# Deliberately excludes \s so that @Maya followed by prose words isn't consumed.
# Multi-word names (e.g. Lady Ashford) require explicit @Name: "..." syntax.
_MENTION_RE = re.compile(r"@([\w][\w\'-]{0,49})", re.UNICODE)


# ---------------------------------------------------------------------------
# Per-paragraph extraction
# ---------------------------------------------------------------------------


def _extract_from_paragraph(
    text: str,
    para_index: int,
    known_names: set[str],
    forms: list[str] | None = None,
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
        results.append(
            {
                "speaker_name": speaker,
                "content": content.strip(),
                "raw_text": m.group(0),
                "paragraph_index": para_index,
                "position_in_paragraph": m.start(),
                "attribution_method": "explicit",
                "confidence": 1.0,
            }
        )
        explicit_matches.add(m.start())

    if results:
        # If we found explicit markers, don't try inference on this paragraph
        return results

    # Pass 2: inferred — build candidate quote list and nearby @mentions
    # Collect all quotes with positions
    quotes: list[tuple[int, int, str]] = []  # (start_pos, end_pos, content)
    for m in _STANDALONE_QUOTE_RE.finditer(text):
        content = (m.group(1) or m.group(2) or "").strip()
        if content and len(content) >= 2:
            quotes.append((m.start(), m.end(), content))

    if not quotes:
        return results

    # Find all @mentions with positions
    mentions: list[tuple[int, str]] = [(m.start(), m.group(1).strip()) for m in _MENTION_RE.finditer(text)]

    for q_pos, q_end, q_content in quotes:
        best_speaker = None
        best_dist = 999
        best_method = "unattributed"

        # A tag that names the speaker beside this quote beats a mention somewhere nearby.
        tagged = (
            _tag_after(text[q_end : q_end + _TAG_WINDOW], forms or [])
            or _tag_before(text[max(0, q_pos - _TAG_WINDOW) : q_pos], forms or [])
            if forms
            else None
        )
        if tagged:
            best_speaker, best_method, best_dist = tagged, "inferred", 0
        else:
            for m_pos, m_name in mentions:
                dist = abs(q_pos - m_pos)
                if dist < best_dist and dist <= 150:
                    best_dist = dist
                    best_speaker = m_name
                    best_method = "inferred"

        confidence = (0.85 if tagged else max(0.0, 1.0 - (best_dist / 150))) if best_speaker else 0.0

        results.append(
            {
                "speaker_name": best_speaker or "",
                "content": q_content,
                "raw_text": f'"{q_content}"',
                "paragraph_index": para_index,
                "position_in_paragraph": q_pos,
                "attribution_method": best_method,
                "confidence": round(confidence, 2),
            }
        )

    return results


def _apply_alternation(raw_blocks: list[dict]) -> list[dict]:
    """
    For runs of consecutive paragraphs with no inferred/explicit speaker,
    try alternating between the last two established speakers.
    """
    last_two: list[str] = []  # most recent speakers (up to 2)
    prev = ""  # who spoke the line before this one
    for block in raw_blocks:
        method = block["attribution_method"]
        if method in ("explicit", "inferred") and block["speaker_name"]:
            name = block["speaker_name"]
            if name in last_two:
                last_two.remove(name)
            elif len(last_two) == 2:
                last_two.pop(0)
            last_two.append(name)
        elif method == "unattributed" and len(last_two) == 2 and prev in last_two:
            # Assign the "other" speaker. (The previous speaker used to be read off this
            # block before anything had written it, so no line was ever alternated.)
            block["speaker_name"] = last_two[0] if last_two[1] == prev else last_two[1]
            block["attribution_method"] = "alternating"
            block["confidence"] = 0.6
        prev = block["speaker_name"]

    return raw_blocks


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_thoughts(scene_content: str, para_index_offset: int = 0) -> list[dict]:
    """Extract inner-monologue blocks from italicized spans (≥2 words) in TipTap HTML."""
    results = []
    for para_idx, char_offset, text in _extract_em_blocks(scene_content):
        results.append(
            {
                "speaker_name": "",
                "content": text,
                "raw_text": f"*{text}*",
                "paragraph_index": para_idx + para_index_offset,
                "position_in_paragraph": char_offset,
                "attribution_method": "unattributed",
                "confidence": 0.0,
                "dialogue_type": "thought",
            }
        )
    return results


def extract_dialogue(
    scene_content: str,
    para_index_offset: int = 0,
    speaker: Callable[[str], str] | None = None,
    names: list[str] | None = None,
) -> list[dict]:
    """Parse TipTap HTML and return raw dialogue block dicts (unsaved).

    Returns spoken dialogue blocks only. Call extract_thoughts() separately for
    inner-monologue blocks.

    `speaker` maps a name as written to the one it means. It runs before alternation,
    which otherwise takes "@Victor" and "<Victor Harlan>" for two people and hands the
    next unattributed line to one of them.

    `names` are the ways the prose names the cast ("Eleanor", "Calder"); with them, a tag
    such as '"…," Eleanor said' attributes the line.
    """
    # Longest first, so "Eleanor Vance said" is read as Eleanor Vance, not a stray "Vance".
    forms = sorted(set(names or []), key=len, reverse=True)
    paragraphs = _html_to_paragraphs(scene_content)
    all_blocks = []
    for i, para in enumerate(paragraphs):
        blocks = _extract_from_paragraph(para, i + para_index_offset, known_names=set(), forms=forms)
        all_blocks.extend(blocks)
    if speaker:
        for b in all_blocks:
            if b["speaker_name"]:
                b["speaker_name"] = speaker(b["speaker_name"])
    _apply_alternation(all_blocks)
    for b in all_blocks:
        b.setdefault("dialogue_type", "speech")
    return all_blocks


#: What extraction decides about a line.
_EXTRACTED = (
    "raw_text",
    "paragraph_index",
    "position_in_paragraph",
    "attribution_method",
    "confidence",
    "speaker_name",
    "character_id",
    "dialogue_type",
)
#: All a hand-corrected line (attribution_method="manual") takes from extraction: where
#: it now sits. Its speaker is the author's.
_PLACE = ("raw_text", "paragraph_index", "position_in_paragraph")

_FIRST_PERSON_PERSPECTIVES = {"first_person", "multiple_pov"}


def _speaker_resolver(characters: list[Character]) -> Callable[[str], Character | None]:
    """A speaker as the prose names them ("<Victor Harlan>", "@Victor") to the character.

    A full name matches however it is cased. Otherwise the forms the Codex matches
    presence by — a first name, either half of "The Visitor (Calder)" — when exactly one
    character answers to it: a shared first name names nobody.
    """
    by_name = {c.name.lower(): c for c in characters if c.name}
    by_form: dict[str, list[Character]] = defaultdict(list)
    for c in characters:
        for form in name_forms(c.name or ""):
            by_form[form.lower()].append(c)

    def resolve(written: str) -> Character | None:
        key = " ".join(written.split()).lower()
        if key in by_name:
            return by_name[key]
        found = by_form.get(key, [])
        return found[0] if len(found) == 1 else None

    return resolve


def _plan(content: str, characters: list[Character], pov_char: Character | None) -> list[dict]:
    """Every line of dialogue and thought in the prose, attributed, in reading order."""
    resolve = _speaker_resolver(characters)

    def canonical(written: str) -> str:
        char = resolve(written)
        return char.name if char else written

    forms = [form for c in characters for form in name_forms(c.name or "")]
    speech = extract_dialogue(content, speaker=canonical, names=forms)
    thoughts = extract_thoughts(content)
    if pov_char:
        # First person: a line nobody is tagged for is the narrator's, and so is every thought.
        for raw in speech:
            if raw["attribution_method"] == "unattributed" and not raw["speaker_name"]:
                raw.update(speaker_name=pov_char.name, attribution_method="pov_default", confidence=0.7)
        for raw in thoughts:
            raw.update(speaker_name=pov_char.name, attribution_method="pov_default", confidence=0.8)
    lines = speech + thoughts
    for raw in lines:
        char = resolve(raw["speaker_name"]) if raw["speaker_name"] else None
        raw["character_id"] = char.id if char else None
    return sorted(lines, key=lambda r: (r["paragraph_index"], r["position_in_paragraph"]))


def _reconcile(
    rows: list[DialogueBlock], planned: list[dict]
) -> tuple[list[tuple[DialogueBlock, dict]], list[dict], list[DialogueBlock]]:
    """What it takes for `rows` to say what `planned` says: updates, creations, deletions.

    A row is matched to a line by its words, in reading order when a line repeats, so a
    line that moved or was re-attributed keeps its row — and its subtext note, which
    nothing in the prose could rebuild.
    """
    unclaimed: dict[str, list[DialogueBlock]] = defaultdict(list)
    for row in rows:
        unclaimed[row.content].append(row)
    updates: list[tuple[DialogueBlock, dict]] = []
    creates: list[dict] = []
    for line in planned:
        if not unclaimed[line["content"]]:
            creates.append(line)
            continue
        row = unclaimed[line["content"]].pop(0)
        fields = _PLACE if row.attribution_method == "manual" else _EXTRACTED
        changed = {f: line[f] for f in fields if getattr(row, f) != line[f]}
        if changed:
            updates.append((row, changed))
    return updates, creates, [row for left in unclaimed.values() for row in left]


def _rows(db: Session, scene_id: str, *, fresh: bool = False) -> list[DialogueBlock]:
    q = db.query(DialogueBlock).filter(DialogueBlock.scene_id == scene_id)
    if fresh:
        q = q.populate_existing()
    return q.order_by(DialogueBlock.paragraph_index, DialogueBlock.position_in_paragraph).all()


def _sync(node: StructureNode, story: Story | None, characters: list[Character], db: Session) -> list[DialogueBlock]:
    pov_id = node.pov_character_id or (story.pov_character_id if story else None)
    first_person = bool(story and story.narrative_perspective in _FIRST_PERSON_PERSPECTIVES)
    pov_char = next((c for c in characters if c.id == pov_id), None) if first_person else None
    planned = _plan(node.content or "", characters, pov_char)

    rows = _rows(db, node.id)
    if not any(_reconcile(rows, planned)):
        return rows

    # Two readers can find a scene stale at once — the Dialogue view opening, a story-wide
    # check running. Take the write lock (pysqlite opens its transaction at the first write,
    # so a DELETE that matches nothing is the way to take it) and look again: the second
    # one in finds what the first one wrote, and has nothing left to do.
    db.execute(delete(DialogueBlock).where(false()))
    updates, creates, deletes = _reconcile(_rows(db, node.id, fresh=True), planned)
    now = datetime.now(UTC)
    for row, changed in updates:
        for field, value in changed.items():
            setattr(row, field, value)
        row.updated_at = now
    for line in creates:
        db.add(
            DialogueBlock(
                id=str(uuid.uuid4()),
                scene_id=node.id,
                content=line["content"],
                created_at=now,
                updated_at=now,
                **{f: line[f] for f in _EXTRACTED},
            )
        )
    for row in deletes:
        db.delete(row)
    db.commit()
    return _rows(db, node.id)


def sync_scene_dialogue(node: StructureNode, db: Session) -> list[DialogueBlock]:
    """Bring a scene's dialogue rows in line with its prose, and return them in reading order.

    The rows are derived data, and anything that rewrites prose (a save, a rename, quote
    normalisation, find-and-replace, the seed) can leave them behind. So every reader calls
    this first rather than trusting every writer to: when nothing differs, nothing is written.

    A hand correction keeps its speaker, a subtext note stays with its line, and a row whose
    line is gone from the prose is deleted.
    """
    story = db.get(Story, node.story_id)
    characters = db.query(Character).filter(Character.story_id == node.story_id).all()
    return _sync(node, story, characters, db)


def sync_story_dialogue(story_id: str, db: Session) -> None:
    """`sync_scene_dialogue` for every scene, before reading a story's dialogue as a whole."""
    story = db.get(Story, story_id)
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    for node in db.query(StructureNode).filter(StructureNode.story_id == story_id).all():
        _sync(node, story, characters, db)


def _gini(values: list[int]) -> float:
    """Compute Gini coefficient for a list of non-negative integers.
    Returns 0 (perfect equality) to ~1 (one person speaks everything).
    """
    if not values or sum(values) == 0:
        return 0.0
    n = len(values)
    sorted_vals = sorted(values)
    cumsum = 0
    for i, v in enumerate(sorted_vals):
        cumsum += (2 * (i + 1) - n - 1) * v
    return cumsum / (n * sum(sorted_vals))


def get_dialogue_stats(story_id: str, db: Session) -> dict:
    """Aggregate dialogue stats across a story for the Health dashboard."""
    sync_story_dialogue(story_id, db)
    # Get all leaf scene IDs for this story
    scene_ids = [row.id for row in db.query(StructureNode.id).filter(StructureNode.story_id == story_id).all()]
    if not scene_ids:
        return {"total_blocks": 0, "by_character": [], "unattributed": 0, "balance_score": None, "monologue_scenes": []}

    blocks = db.query(DialogueBlock).filter(DialogueBlock.scene_id.in_(scene_ids)).all()

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

    # Balance score: 1 - Gini (higher = more balanced dialogue)
    word_counts = [v["word_count"] for v in by_char.values()]
    gini = _gini(word_counts) if len(word_counts) >= 2 else None
    balance_score = round((1 - gini) * 100) if gini is not None else None

    # Monologue scenes: scenes where one character speaks >80% of dialogue words
    scene_speakers: dict[str, dict[str, int]] = {}  # scene_id → {speaker: word_count}
    for b in blocks:
        sid = b.scene_id
        spk = b.speaker_name or "Unknown"
        scene_speakers.setdefault(sid, {})
        scene_speakers[sid][spk] = scene_speakers[sid].get(spk, 0) + len(b.content.split())

    monologue_scenes = []
    for sid, speakers in scene_speakers.items():
        if len(speakers) < 2:
            continue  # Only one speaker — not really a monologue concern
        total_scene_words = sum(speakers.values())
        dominant = max(speakers.items(), key=lambda kv: kv[1])[0]
        dominant_pct = speakers[dominant] / total_scene_words if total_scene_words > 0 else 0
        if dominant_pct >= 0.80:
            monologue_scenes.append({"scene_id": sid, "dominant_speaker": dominant, "pct": round(dominant_pct * 100)})

    return {
        "total_blocks": total,
        "unattributed": unattributed,
        "by_character": sorted(by_char.values(), key=lambda x: x["word_count"], reverse=True),
        "balance_score": balance_score,  # 0–100, higher = more balanced
        "monologue_scenes": monologue_scenes,  # scenes dominated by one speaker
    }


def get_interaction_matrix(story_id: str, db: Session) -> list[dict]:
    """Return pairwise character interaction data (co-presence in scenes)."""
    sync_story_dialogue(story_id, db)
    scene_ids = [row.id for row in db.query(StructureNode.id).filter(StructureNode.story_id == story_id).all()]
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
        if b.character_id:
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
