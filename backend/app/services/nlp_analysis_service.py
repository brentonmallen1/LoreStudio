"""
spaCy-based NLP prose analysis service.

All analysis is local, deterministic, and reproducible — no LLM involved.
Uses the en_core_web_sm pipeline (POS tagger, dependency parser, NER).

Available checks:
  - passive_voice    : Detect passive constructions via dep labels
  - adverb_overuse   : Flag -ly adverbs modifying verbs above a threshold
  - said_bookisms    : Identify unusual dialogue attribution verbs
  - repeated_words   : Same lemma appearing within a character window
  - sentence_variety : Sentence length statistics and histogram

NER entity extraction is handled separately by extract_unknown_entities()
since it needs access to the Lorebook's known characters and locations.
"""

from __future__ import annotations

import statistics
from collections import defaultdict

from .text_utils import html_to_text
from ..schemas.nlp_analysis import (
    PassageFinding,
    PassiveVoiceResult,
    AdverbResult,
    SaidBookismResult,
    RepeatedWordResult,
    SentenceVarietyResult,
    SentenceLengthBucket,
    SceneNLPAnalysis,
    EntitySuggestion,
    EntitySuggestionsResponse,
)


# ---------------------------------------------------------------------------
# Lazy spaCy loader (shared with pronoun_service)
# ---------------------------------------------------------------------------

_nlp = None


def get_nlp():
    """Load spaCy en_core_web_sm on first use. Shared singleton across requests."""
    global _nlp
    if _nlp is None:
        import spacy
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Dialogue attribution verbs that are perfectly acceptable
_COMMON_ATTRIBUTION_VERBS = {
    "said", "say", "ask", "asked", "reply", "replied", "answer", "answered",
    "tell", "told", "add", "added", "continue", "continued",
}

# Attribution verbs that are more stylistically notable (flag as "warning")
_NOTABLE_ATTRIBUTION_VERBS = {
    "whisper", "whispered", "mutter", "muttered", "snap", "snapped",
    "shout", "shouted", "yell", "yelled", "cry", "cried", "call", "called",
    "groan", "groaned", "sigh", "sighed", "laugh", "laughed", "chuckle",
    "chuckled", "growl", "growled", "hiss", "hissed", "bark", "barked",
}

# Attribution verbs considered extreme bookisms (flag as "issue")
_EXTREME_BOOKISMS = {
    "ejaculate", "ejaculated", "exclaim", "exclaimed", "intone", "intoned",
    "vociferate", "vociferated", "expostulate", "expostulated", "declaim",
    "declaimed", "articulate", "articulated", "enunciate", "enunciated",
    "opine", "opined", "quip", "quipped", "chortle", "chortled",
    "guffaw", "guffawed", "blurt", "blurted",
}

_SENTENCE_BUCKETS = [
    ("1–5", 1, 5),
    ("6–10", 6, 10),
    ("11–20", 11, 20),
    ("21–35", 21, 35),
    ("36+", 36, 9999),
]


# ---------------------------------------------------------------------------
# Analysis functions
# ---------------------------------------------------------------------------

def _detect_passive_voice(doc) -> PassiveVoiceResult:
    """
    Find passive constructions using dependency labels.
    Looks for tokens with dep_ 'nsubjpass' or 'auxpass' anywhere in the sentence.
    """
    findings: list[PassageFinding] = []
    sentences = list(doc.sents)

    for sent in sentences:
        if any(tok.dep_ in ("nsubjpass", "auxpass") for tok in sent):
            findings.append(PassageFinding(
                passage=sent.text.strip(),
                char_offset=sent.start_char,
                severity="info",
                explanation="Passive construction detected",
            ))

    count = len(sentences)
    passive = len(findings)
    return PassiveVoiceResult(
        findings=findings,
        sentence_count=count,
        passive_count=passive,
        percentage=round(passive / count * 100, 1) if count else 0.0,
    )


def _detect_adverbs(doc, threshold: float = 5.0) -> AdverbResult:
    """
    Flag -ly adverbs that directly modify verbs.
    POS tag ADV + lemma ending in 'ly' + head is VERB.
    """
    findings: list[PassageFinding] = []
    word_count = len([t for t in doc if not t.is_space])
    adverb_count = 0

    for tok in doc:
        if tok.pos_ != "ADV" or not tok.lemma_.endswith("ly"):
            continue
        if tok.head.pos_ not in ("VERB", "AUX"):
            continue

        adverb_count += 1
        sent = tok.sent
        findings.append(PassageFinding(
            passage=sent.text.strip(),
            char_offset=sent.start_char,
            severity="warning" if (word_count and adverb_count / word_count * 100 > threshold) else "info",
            explanation=f'"{tok.text}" modifies "{tok.head.text}" — consider a stronger verb',
        ))

    percentage = round(adverb_count / word_count * 100, 1) if word_count else 0.0
    # Re-set severity based on final percentage
    if percentage > threshold:
        for f in findings:
            f.severity = "warning"

    return AdverbResult(
        findings=findings,
        word_count=word_count,
        adverb_count=adverb_count,
        percentage=percentage,
        threshold=threshold,
    )


def _detect_said_bookisms(doc) -> SaidBookismResult:
    """
    Find dialogue attribution verbs other than common ones (said, asked, etc.).
    Looks for VERB tokens whose lemma is in known bookism sets.
    Simple pattern: a VERB that has a nsubj (speaker) and is adjacent to a sentence
    containing a dialogue quote marker.
    """
    findings: list[PassageFinding] = []
    total_attributions = 0
    bookism_count = 0

    for tok in doc:
        if tok.pos_ != "VERB":
            continue
        lemma = tok.lemma_.lower()

        if lemma in _COMMON_ATTRIBUTION_VERBS:
            total_attributions += 1
            continue
        if lemma in _NOTABLE_ATTRIBUTION_VERBS or lemma in _EXTREME_BOOKISMS:
            # Check if this verb has a person-like subject (pronoun or proper noun)
            has_speaker = any(
                child.dep_ == "nsubj" and child.pos_ in ("NOUN", "PROPN", "PRON")
                for child in tok.children
            )
            if has_speaker:
                total_attributions += 1
                bookism_count += 1
                severity = "issue" if lemma in _EXTREME_BOOKISMS else "warning"
                sent = tok.sent
                findings.append(PassageFinding(
                    passage=sent.text.strip(),
                    char_offset=sent.start_char,
                    severity=severity,
                    explanation=f'"{tok.text}" as a dialogue attribution verb',
                    suggestion='Consider "said" or "asked" for invisible attribution',
                ))

    return SaidBookismResult(
        findings=findings,
        total_attributions=total_attributions,
        bookism_count=bookism_count,
    )


def _detect_repeated_words(doc, window: int = 200) -> RepeatedWordResult:
    """
    Flag the same lemma appearing within `window` characters (excluding stop words,
    punctuation, and very short words).
    """
    findings: list[PassageFinding] = []
    seen: dict[str, int] = {}  # lemma → last char offset

    for tok in doc:
        if tok.is_stop or tok.is_punct or tok.is_space or len(tok.text) < 4:
            continue
        if tok.pos_ in ("PUNCT", "SYM", "NUM"):
            continue

        lemma = tok.lemma_.lower()
        offset = tok.idx

        if lemma in seen and (offset - seen[lemma]) <= window:
            sent = tok.sent
            findings.append(PassageFinding(
                passage=sent.text.strip(),
                char_offset=sent.start_char,
                severity="info",
                explanation=f'"{tok.text}" repeats within {window} characters',
            ))

        seen[lemma] = offset

    return RepeatedWordResult(findings=findings, window_chars=window)


def _analyze_sentence_variety(doc) -> SentenceVarietyResult:
    """Compute sentence length statistics and a word-count histogram."""
    sentences = list(doc.sents)
    if not sentences:
        return SentenceVarietyResult()

    lengths = [len([t for t in sent if not t.is_space and not t.is_punct]) for sent in sentences]
    lengths = [l for l in lengths if l > 0]

    if not lengths:
        return SentenceVarietyResult()

    mean = statistics.mean(lengths)
    std_dev = statistics.stdev(lengths) if len(lengths) > 1 else 0.0

    # Build histogram
    histogram: list[SentenceLengthBucket] = []
    for label, lo, hi in _SENTENCE_BUCKETS:
        count = sum(1 for l in lengths if lo <= l <= hi)
        histogram.append(SentenceLengthBucket(label=label, count=count))

    # Assess variety
    if len(lengths) < 3:
        assessment = "too_short"
    elif std_dev < 3.0:
        assessment = "monotonous"
    elif std_dev > 15.0:
        assessment = "erratic"
    else:
        assessment = "varied"

    return SentenceVarietyResult(
        sentence_count=len(lengths),
        mean_length=round(mean, 1),
        std_dev=round(std_dev, 1),
        min_length=min(lengths),
        max_length=max(lengths),
        histogram=histogram,
        assessment=assessment,
    )


# ---------------------------------------------------------------------------
# Public: per-scene analysis
# ---------------------------------------------------------------------------

ALL_CHECKS = {"passive_voice", "adverb_overuse", "said_bookisms", "repeated_words", "sentence_variety"}


def analyze_scene(
    scene_html: str,
    checks: set[str] | None = None,
) -> dict:
    """
    Run selected NLP checks on a single scene's HTML content.
    Returns a dict matching SceneNLPAnalysis fields (excluding scene_id/title).

    checks=None runs all checks. Pass a subset to run only specific ones.
    """
    if checks is None:
        checks = ALL_CHECKS

    text = html_to_text(scene_html)
    if not text.strip():
        return {"word_count": 0}

    nlp = get_nlp()
    doc = nlp(text)
    word_count = len([t for t in doc if not t.is_space and not t.is_punct])

    result: dict = {"word_count": word_count}

    if "passive_voice" in checks:
        result["passive_voice"] = _detect_passive_voice(doc)
    if "adverb_overuse" in checks:
        result["adverb_overuse"] = _detect_adverbs(doc)
    if "said_bookisms" in checks:
        result["said_bookisms"] = _detect_said_bookisms(doc)
    if "repeated_words" in checks:
        result["repeated_words"] = _detect_repeated_words(doc)
    if "sentence_variety" in checks:
        result["sentence_variety"] = _analyze_sentence_variety(doc)

    return result


# ---------------------------------------------------------------------------
# Public: NER-based Lorebook suggestions
# ---------------------------------------------------------------------------

def extract_unknown_entities(
    scenes: list[tuple[str, str, str]],  # (scene_id, scene_title, scene_html)
    known_characters: set[str],
    known_locations: set[str],
) -> EntitySuggestionsResponse:
    """
    Run NER across all scenes and surface proper nouns not in the Lorebook.

    Aggregates by entity text: returns occurrence counts and scene lists.
    Filters out very short strings (< 3 chars) and numbers.
    """
    nlp = get_nlp()

    # Track: entity_text → {label, scene_ids, scene_titles, occurrences}
    person_map: dict[str, dict] = defaultdict(lambda: {"scene_ids": [], "scene_titles": [], "occurrences": 0})
    location_map: dict[str, dict] = defaultdict(lambda: {"scene_ids": [], "scene_titles": [], "occurrences": 0})

    known_chars_lower = {n.lower() for n in known_characters}
    known_locs_lower = {n.lower() for n in known_locations}

    for scene_id, scene_title, scene_html in scenes:
        text = html_to_text(scene_html)
        if not text.strip():
            continue

        doc = nlp(text)
        seen_in_scene: set[str] = set()

        for ent in doc.ents:
            if len(ent.text.strip()) < 3:
                continue
            text_lower = ent.text.lower().strip()

            if ent.label_ == "PERSON" and text_lower not in known_chars_lower:
                entry = person_map[ent.text.strip()]
                entry["occurrences"] += 1
                if scene_id not in seen_in_scene:
                    entry["scene_ids"].append(scene_id)
                    entry["scene_titles"].append(scene_title)
                    seen_in_scene.add(scene_id)

            elif ent.label_ in ("GPE", "LOC") and text_lower not in known_locs_lower:
                entry = location_map[ent.text.strip()]
                entry["occurrences"] += 1
                if scene_id not in seen_in_scene:
                    entry["scene_ids"].append(scene_id)
                    entry["scene_titles"].append(scene_title)
                    seen_in_scene.add(scene_id)

    def _build_suggestions(ent_map: dict, label: str) -> list[EntitySuggestion]:
        suggestions = []
        for text, data in sorted(ent_map.items(), key=lambda x: -x[1]["occurrences"]):
            suggestions.append(EntitySuggestion(
                text=text,
                label=label,
                scene_count=len(data["scene_ids"]),
                occurrences=data["occurrences"],
                scene_ids=data["scene_ids"],
                scene_titles=data["scene_titles"],
            ))
        return suggestions

    return EntitySuggestionsResponse(
        character_suggestions=_build_suggestions(person_map, "PERSON"),
        location_suggestions=_build_suggestions(location_map, "LOC"),
    )
