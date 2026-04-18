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
    TenseShift,
    TenseConsistencyResult,
    POVDriftFinding,
    POVDriftResult,
    SceneEditorialAnalysis,
    EditorialConsistencyResponse,
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
# Editorial consistency checks (tense + POV)
# ---------------------------------------------------------------------------

# Finite verb POS tags by tense
_PAST_TAGS = {"VBD", "VBN"}       # past simple, past participle
_PRESENT_TAGS = {"VBZ", "VBP"}    # 3rd-person singular present, bare present

# Perception/cognition verbs that signal being inside a character's head
_PERSPECTIVE_VERBS = {
    "feel", "felt", "think", "thought", "know", "knew", "realize", "realized",
    "wonder", "wondered", "believe", "believed", "see", "saw", "hear", "heard",
    "notice", "noticed", "understand", "understood", "remember", "remembered",
    "sense", "sensed", "decide", "decided", "want", "wanted", "wish", "wished",
    "hope", "hoped", "fear", "feared", "imagine", "imagined",
}


def check_tense_consistency(doc) -> TenseConsistencyResult:
    """
    Detect tense inconsistencies across sentences.
    Tags VBD/VBN as past and VBZ/VBP as present.
    Flags sentences that deviate from the document's dominant tense.
    Only flags sentences with at least 2 finite verbs to reduce false positives.
    """
    sentence_data: list[tuple] = []  # (sent, tense, past_count, present_count)

    for sent in doc.sents:
        past_c = sum(1 for tok in sent if tok.pos_ == "VERB" and tok.tag_ in _PAST_TAGS)
        pres_c = sum(1 for tok in sent if tok.pos_ == "VERB" and tok.tag_ in _PRESENT_TAGS)
        if past_c == 0 and pres_c == 0:
            continue
        tense = "past" if past_c >= pres_c else "present"
        sentence_data.append((sent, tense, past_c, pres_c))

    if not sentence_data:
        return TenseConsistencyResult()

    past_sents = sum(1 for _, t, _, _ in sentence_data if t == "past")
    pres_sents = sum(1 for _, t, _, _ in sentence_data if t == "present")
    dominant = "past" if past_sents >= pres_sents else "present"
    if past_sents == pres_sents:
        dominant = "mixed"

    findings: list[TenseShift] = []
    for sent, tense, past_c, pres_c in sentence_data:
        if tense != dominant and dominant != "mixed" and (past_c + pres_c) >= 2:
            findings.append(TenseShift(
                sentence=sent.text.strip(),
                char_offset=sent.start_char,
                dominant_tense=dominant,
                detected_tense=tense,
                severity="warning",
            ))

    return TenseConsistencyResult(
        findings=findings,
        dominant_tense=dominant,
        past_sentence_count=past_sents,
        present_sentence_count=pres_sents,
        shift_count=len(findings),
    )


def check_pov_drift(doc) -> POVDriftResult:
    """
    Detect potential head-hopping by tracking named subjects of perception/cognition verbs.
    When multiple distinct named characters use perspective verbs in the same scene,
    it suggests the narrative may be entering more than one character's head.
    """
    # Map: sentence → set of named subjects of perspective verbs
    perspective_subject_counts: dict[str, int] = {}
    findings: list[POVDriftFinding] = []

    for sent in doc.sents:
        sent_persp_subjects: set[str] = set()
        for tok in sent:
            if tok.lemma_.lower() not in _PERSPECTIVE_VERBS:
                continue
            for child in tok.children:
                if child.dep_ in ("nsubj", "nsubjpass") and child.pos_ in ("PROPN", "NOUN") and len(child.text) > 1 and not child.is_stop:
                    name = child.text.strip()
                    sent_persp_subjects.add(name)
                    perspective_subject_counts[name] = perspective_subject_counts.get(name, 0) + 1

        if sent_persp_subjects:
            # Cross-reference: are these subjects already in the registry?
            all_known = set(perspective_subject_counts.keys())
            other_subjects = {s for s in all_known if s not in sent_persp_subjects and perspective_subject_counts.get(s, 0) > 0}
            # Only flag if there are perspective verbs with subjects AND we've seen other perspective subjects before
            if sent_persp_subjects and other_subjects:
                findings.append(POVDriftFinding(
                    sentence=sent.text.strip(),
                    char_offset=sent.start_char,
                    subjects=sorted(sent_persp_subjects),
                    severity="warning",
                    explanation=(
                        f"{', '.join(sorted(sent_persp_subjects))} uses a perspective verb "
                        f"after {', '.join(sorted(other_subjects))} earlier in the scene"
                    ),
                ))

    dominant = max(perspective_subject_counts, key=perspective_subject_counts.get) if perspective_subject_counts else ""
    all_subjects = sorted(perspective_subject_counts.keys())[:10]

    # Deduplicate findings (only keep unique sentence offsets)
    seen_offsets: set[int] = set()
    unique_findings: list[POVDriftFinding] = []
    for f in findings:
        if f.char_offset not in seen_offsets:
            seen_offsets.add(f.char_offset)
            unique_findings.append(f)

    return POVDriftResult(
        findings=unique_findings,
        dominant_subject=dominant,
        perspective_subjects=all_subjects,
    )


def analyze_scene_editorial(scene_html: str) -> dict:
    """
    Run editorial consistency checks (tense + POV) on a scene.
    Returns a dict matching SceneEditorialAnalysis fields (excluding scene_id/title).
    """
    text = html_to_text(scene_html)
    if not text.strip():
        return {"word_count": 0}

    nlp = get_nlp()
    doc = nlp(text)
    word_count = len([t for t in doc if not t.is_space and not t.is_punct])

    return {
        "word_count": word_count,
        "tense_consistency": check_tense_consistency(doc),
        "pov_drift": check_pov_drift(doc),
    }


# ---------------------------------------------------------------------------
# Public: NER-based Lorebook suggestions
# ---------------------------------------------------------------------------

_NLP_CHUNK_SIZE = 50_000  # chars; split scenes larger than this before NLP


def _iter_text_chunks(text: str, chunk_size: int = _NLP_CHUNK_SIZE) -> list[str]:
    """
    Split long text into chunks at sentence boundaries to stay within
    a comfortable spaCy processing window. Overlaps are intentionally
    avoided — entity counts may under-count for entities spanning chunks,
    but that's acceptable for name discovery.
    """
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        # Walk back to last whitespace to avoid splitting mid-word
        if end < len(text):
            boundary = text.rfind(" ", start, end)
            if boundary > start:
                end = boundary
        chunks.append(text[start:end])
        start = end
    return chunks


def extract_unknown_entities(
    scenes: list[tuple[str, str, str]],  # (scene_id, scene_title, scene_html)
    known_characters: set[str],
    known_locations: set[str],
) -> EntitySuggestionsResponse:
    """
    Run NER across all scenes and surface proper nouns not in the Lorebook.

    Uses nlp.pipe() for batched processing — significantly faster than one
    call per scene on large manuscripts. Long scenes are chunked first.
    Aggregates by entity text: returns occurrence counts and scene lists.
    Filters out very short strings (< 3 chars) and numbers.
    """
    nlp = get_nlp()

    person_map: dict[str, dict] = defaultdict(lambda: {"scene_ids": [], "scene_titles": [], "occurrences": 0})
    location_map: dict[str, dict] = defaultdict(lambda: {"scene_ids": [], "scene_titles": [], "occurrences": 0})

    known_chars_lower = {n.lower() for n in known_characters}
    known_locs_lower = {n.lower() for n in known_locations}

    # Build flat list of (scene_id, scene_title, chunk_text) — one entry per chunk.
    # Most scenes produce a single chunk; very large scenes produce multiple.
    pipe_items: list[tuple[str, str, str]] = []
    for scene_id, scene_title, scene_html in scenes:
        text = html_to_text(scene_html)
        if not text.strip():
            continue
        for chunk in _iter_text_chunks(text):
            pipe_items.append((scene_id, scene_title, chunk))

    if not pipe_items:
        return EntitySuggestionsResponse()

    # Process all chunks in a single batched pass through spaCy.
    texts = [chunk for _, _, chunk in pipe_items]
    docs = nlp.pipe(texts, batch_size=32)

    for (scene_id, scene_title, _), doc in zip(pipe_items, docs):
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


# ---------------------------------------------------------------------------
# Character-scoped dialogue prose analysis
# ---------------------------------------------------------------------------

def analyze_character_dialogue_prose(dialogue_texts: list[str]) -> dict:
    """
    Run NLP prose checks on a character's dialogue lines only.
    Checks: said_bookisms, sentence_variety, adverb_overuse.

    dialogue_texts: plain text of each dialogue block.
    Returns a subset of SceneNLPAnalysis fields.
    """
    combined = " ".join(t.strip() for t in dialogue_texts if t.strip())
    if not combined:
        return {"word_count": 0, "line_count": 0}

    nlp = get_nlp()
    doc = nlp(combined)
    word_count = len([t for t in doc if not t.is_space and not t.is_punct])

    return {
        "word_count": word_count,
        "line_count": len(dialogue_texts),
        "said_bookisms": _detect_said_bookisms(doc),
        "sentence_variety": _analyze_sentence_variety(doc),
        "adverb_overuse": _detect_adverbs(doc),
    }


# ---------------------------------------------------------------------------
# Character Voice Distinctness
# ---------------------------------------------------------------------------

def analyze_voice_distinctness(
    character_dialogue: list[dict],  # [{character_id, character_name, content (text)}]
) -> dict:
    """
    Analyze dialogue fingerprints per character and compute pairwise similarity.

    For each character computes:
    - vocabulary size (unique lemmas)
    - vocabulary richness (unique / total tokens)
    - signature words (top 5 most distinctive lemmas vs other characters)
    - avg sentence length, question ratio, exclamation ratio

    Pairwise similarity uses Jaccard on top-50 word sets.
    """
    from collections import Counter

    nlp = get_nlp()

    # Collect per-character data
    char_data: dict[str, dict] = {}  # character_id → {name, words, total, sentences, questions, exclamations}

    for entry in character_dialogue:
        cid = entry["character_id"]
        name = entry["character_name"]
        text = entry.get("content", "").strip()
        if not text:
            continue

        doc = nlp(text)
        tokens = [t.lemma_.lower() for t in doc if not t.is_punct and not t.is_space and not t.is_stop and len(t.text) > 1]
        sents = list(doc.sents)
        sent_lengths = [len([t for t in s if not t.is_punct and not t.is_space]) for s in sents]
        questions = sum(1 for s in sents if s.text.strip().endswith("?"))
        exclamations = sum(1 for s in sents if s.text.strip().endswith("!"))

        if cid not in char_data:
            char_data[cid] = {
                "name": name,
                "words": Counter(),
                "total_tokens": 0,
                "sent_lengths": [],
                "questions": 0,
                "exclamations": 0,
                "total_sents": 0,
            }

        char_data[cid]["words"].update(tokens)
        char_data[cid]["total_tokens"] += len(tokens)
        char_data[cid]["sent_lengths"].extend(sent_lengths)
        char_data[cid]["questions"] += questions
        char_data[cid]["exclamations"] += exclamations
        char_data[cid]["total_sents"] += len(sents)

    if not char_data:
        return {"profiles": [], "similar_pairs": [], "overall_distinctness": "distinct"}

    # Build profiles
    profiles = []
    char_top_words: dict[str, set] = {}  # For Jaccard similarity

    for cid, data in char_data.items():
        total = data["total_tokens"]
        vocab_size = len(data["words"])
        richness = round(vocab_size / total, 3) if total > 0 else 0.0

        # Signature words: words this character uses significantly more than others
        # Simple version: top 50 words by frequency for this character
        top50 = {w for w, _ in data["words"].most_common(50)}
        char_top_words[cid] = top50

        # Find words unique or highly skewed to this character vs others
        all_others: Counter = Counter()
        for other_cid, other_data in char_data.items():
            if other_cid != cid:
                all_others.update(other_data["words"])

        signature = []
        for word, count in data["words"].most_common(20):
            if count > 1 and all_others.get(word, 0) < count:
                signature.append(word)
            if len(signature) >= 5:
                break

        sents = data["sent_lengths"]
        avg_sent = round(statistics.mean(sents), 1) if sents else 0.0
        total_s = data["total_sents"]
        q_ratio = round(data["questions"] / total_s, 3) if total_s > 0 else 0.0
        excl_ratio = round(data["exclamations"] / total_s, 3) if total_s > 0 else 0.0

        profiles.append({
            "character_id": cid,
            "character_name": data["name"],
            "total_lines": total_s,
            "vocabulary_size": vocab_size,
            "vocabulary_richness": richness,
            "signature_words": signature,
            "avg_sentence_length": avg_sent,
            "question_ratio": q_ratio,
            "exclamation_ratio": excl_ratio,
        })

    # Pairwise similarity (Jaccard on top-50 words)
    SIMILARITY_THRESHOLD = 0.35
    similar_pairs = []
    char_ids = list(char_data.keys())
    for i in range(len(char_ids)):
        for j in range(i + 1, len(char_ids)):
            a, b = char_ids[i], char_ids[j]
            set_a = char_top_words[a]
            set_b = char_top_words[b]
            intersection = len(set_a & set_b)
            union = len(set_a | set_b)
            score = round(intersection / union, 3) if union > 0 else 0.0
            if score >= SIMILARITY_THRESHOLD:
                shared = sorted(set_a & set_b)[:5]
                similar_pairs.append({
                    "char_a_id": a,
                    "char_a_name": char_data[a]["name"],
                    "char_b_id": b,
                    "char_b_name": char_data[b]["name"],
                    "similarity_score": score,
                    "shared_patterns": shared,
                })

    similar_pairs.sort(key=lambda p: -p["similarity_score"])

    if not similar_pairs:
        distinctness = "distinct"
    elif max(p["similarity_score"] for p in similar_pairs) >= 0.6:
        distinctness = "homogeneous"
    else:
        distinctness = "some_overlap"

    return {
        "profiles": profiles,
        "similar_pairs": similar_pairs,
        "overall_distinctness": distinctness,
    }
