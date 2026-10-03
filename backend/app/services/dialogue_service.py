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
from .codex.presence import known_as, name_forms
from .prose_syntax import Lexicon, find_mentions, find_quotes, find_speaker_tags
from .text_utils import extract_em_blocks as _extract_em_blocks
from .text_utils import html_to_paragraphs as _html_to_paragraphs

_NO_NAMES = Lexicon([])

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# The lines themselves (a tagged "…"<Name>, an untagged quote) and @mentions are read by
# the one grammar (services/prose_syntax), which the editor shares (doc 16): straight,
# curly or single quotes, a space before <Name>, and "@Eleanor's" is Eleanor.

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
    for t in find_speaker_tags(text):
        results.append(
            {
                "speaker_name": t.speaker,
                "content": text[t.quote_start + 1 : t.quote_end - 1].strip(),
                "raw_text": text[t.quote_start : t.end],
                "paragraph_index": para_index,
                "position_in_paragraph": t.quote_start,
                "attribution_method": "explicit",
                "confidence": 1.0,
            }
        )
        explicit_matches.add(t.quote_start)

    # Quotes beside an explicit marker are read on, so that '"…"<Calder> she said. "…"' gives
    # its second half to Calder through the paragraph rule below.

    # Pass 2: inferred — build candidate quote list and nearby @mentions
    # Collect all quotes with positions
    quotes: list[tuple[int, int, str]] = []  # (start_pos, end_pos, content)
    for q in find_quotes(text):
        if len(q.words) >= 2 and not _is_scare_quote(q.words):
            quotes.append((q.start, q.end, q.words))

    if not quotes:
        return results

    # Find all @mentions with positions
    # A name inside the quote is who the line is about, not who says it.
    mentions: list[tuple[int, str]] = [
        (m.start, m.written)
        for m in find_mentions(text, _NO_NAMES)
        if m.kind == "character" and not any(a <= m.start < b for a, b, _ in quotes)
    ]

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

    # A paragraph is one speaker's: in '"I could burn them," Eleanor said. "The whole set."'
    # the second half is Eleanor's too, though only the first sits beside her name.
    named = {r["speaker_name"] for r in results if r["speaker_name"]}
    if len(named) == 1:
        speaker = next(iter(named))
        for r in results:
            if not r["speaker_name"]:
                r.update(speaker_name=speaker, attribution_method="inferred", confidence=0.75)

    return results


def _is_scare_quote(content: str) -> bool:
    """A word or two held at arm's length ('an "inspection"'), not a line anyone says."""
    return len(content.split()) <= 3 and content[0].islower() and not re.search(r"[.,!?;:\u2014-]$", content)


def _without_lines(para: str) -> str:
    """The paragraph with each quoted line (tag and all) replaced by a mark."""
    spans = sorted(
        [(t.quote_start, t.end) for t in find_speaker_tags(para)] + [(q.start, q.end) for q in find_quotes(para)]
    )
    out, last = [], 0
    for a, b in spans:
        if a < last:
            continue
        out.append(para[last:a] + " \u00b6")
        last = b
    out.append(para[last:])
    return "".join(out)


def _beat_speaker(para: str, forms: list[str], canonical: Callable[[str], str]) -> str | None:
    """The one character a paragraph's narration names, outside its quotes.

    '"I don't need parts." Eleanor looked at the wreck.' is Eleanor's line: by convention the
    character acting in a speaker's paragraph is the speaker. Two characters named, or none,
    and the line is left for alternation or the author.
    """
    # Quotes become a mark, so '"…," the Visitor said' still opens a sentence after it.
    narration = _without_lines(para)
    taken: list[tuple[int, int]] = []
    named: set[str] = set()
    for form in forms:  # longest first, so "Eleanor Vance" is not also a stray "Vance"
        # Only a name that opens a sentence acts: "Eleanor met her eyes", not "She looked at Eleanor".
        subject = rf"(?:^|[.!?\u00b6]\s*,?)\s*@?({re.escape(form)})(?!\w)"
        for m in re.finditer(subject, narration, _case(form)):
            if any(a < m.end(1) and m.start(1) < b for a, b in taken):
                continue
            taken.append((m.start(1), m.end(1)))
            named.add(canonical(form))
    return next(iter(named)) if len(named) == 1 else None


def _apply_alternation(raw_blocks: list[dict]) -> list[dict]:
    """
    For runs of consecutive paragraphs with no inferred/explicit speaker,
    try alternating between the last two established speakers.
    """
    last_two: list[str] = []  # most recent speakers (up to 2)
    prev = ""  # who spoke the line before this one
    prev_para = -1
    for block in raw_blocks:
        method = block["attribution_method"]
        if method == "unattributed" and prev and block["paragraph_index"] == prev_para:
            # The second half of '"What I want," she said, "is…"' is the same turn, not the next.
            block.update(speaker_name=prev, attribution_method="alternating", confidence=0.6)
        elif method in ("explicit", "inferred") and block["speaker_name"]:
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
        prev_para = block["paragraph_index"]

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
        if blocks and not any(b["speaker_name"] for b in blocks):
            beat = _beat_speaker(para, forms, speaker or (lambda n: n))
            for b in blocks:
                if beat:
                    b.update(speaker_name=beat, attribution_method="inferred", confidence=0.6)
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
    by_name = {" ".join(n.split()).lower(): c for c in characters for n in known_as(c) if n.strip()}
    by_form: dict[str, list[Character]] = defaultdict(list)
    for c in characters:
        for form in {f for n in known_as(c) for f in name_forms(n)}:
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

    forms = [form for c in characters for n in known_as(c) for form in name_forms(n)]
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


def plan_scene(node: StructureNode, story: Story | None, characters: list[Character]) -> list[dict]:
    """Every line in the scene's prose as the reader attributes it, before any hand correction."""
    pov_id = node.pov_character_id or (story.pov_character_id if story else None)
    first_person = bool(story and story.narrative_perspective in _FIRST_PERSON_PERSPECTIVES)
    pov_char = next((c for c in characters if c.id == pov_id), None) if first_person else None
    return _plan(node.content or "", characters, pov_char)


def _sync(node: StructureNode, story: Story | None, characters: list[Character], db: Session) -> list[DialogueBlock]:
    planned = plan_scene(node, story, characters)

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


def gini(values: list[int]) -> float:
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
