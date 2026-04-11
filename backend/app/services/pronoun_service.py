"""
Pronoun refactoring service.

Approach:
  1. LLM identifies which pronouns/gendered terms refer to the character
     (returns exact context phrases + target word — no prose generation).
  2. This service applies deterministic, case-preserving substitutions via
     a lookup table.
  3. A targeted regex pass fixes irregular conjugation for the new pronoun
     (e.g. "They was" → "They were", "she write" → "she writes").
  4. spaCy is loaded lazily for future features (POV detection, NER, etc.)
     but conjugation fixing uses regex to stay predictable.

The LLM touches zero prose. All text changes are mechanical and reviewable.
"""

from __future__ import annotations

import re

from .text_utils import html_to_text as _html_to_text  # noqa: F401 (re-exported for router compat)


# ---------------------------------------------------------------------------
# Substitution tables
# ---------------------------------------------------------------------------

# For each source pronoun (lowercase), map word_type → replacement (lowercase)
_FROM_TABLE: dict[str, dict[str, str]] = {
    # she/her → <target>
    "she":      {"subject": "she", "object": "her", "possessive_det": "her",  "possessive_pron": "hers",   "reflexive": "herself"},
    "her":      {"subject": "she", "object": "her", "possessive_det": "her",  "possessive_pron": "hers",   "reflexive": "herself"},
    "hers":     {"subject": "she", "object": "her", "possessive_det": "her",  "possessive_pron": "hers",   "reflexive": "herself"},
    "herself":  {"subject": "she", "object": "her", "possessive_det": "her",  "possessive_pron": "hers",   "reflexive": "herself"},
    # he/him → <target>
    "he":       {"subject": "he",  "object": "him", "possessive_det": "his",  "possessive_pron": "his",    "reflexive": "himself"},
    "him":      {"subject": "he",  "object": "him", "possessive_det": "his",  "possessive_pron": "his",    "reflexive": "himself"},
    "his":      {"subject": "he",  "object": "him", "possessive_det": "his",  "possessive_pron": "his",    "reflexive": "himself"},
    "himself":  {"subject": "he",  "object": "him", "possessive_det": "his",  "possessive_pron": "his",    "reflexive": "himself"},
    # they/them → <target>
    "they":     {"subject": "they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
    "them":     {"subject": "they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
    "their":    {"subject": "they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
    "theirs":   {"subject": "they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
    "themselves":{"subject":"they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
    "themself": {"subject": "they","object": "them","possessive_det": "their","possessive_pron": "theirs", "reflexive": "themselves"},
}

# Target pronoun sets keyed by subject form
_TARGET_SETS: dict[str, dict[str, str]] = {
    "she":  {"subject": "she",  "object": "her",  "possessive_det": "her",   "possessive_pron": "hers",   "reflexive": "herself"},
    "he":   {"subject": "he",   "object": "him",  "possessive_det": "his",   "possessive_pron": "his",    "reflexive": "himself"},
    "they": {"subject": "they", "object": "them", "possessive_det": "their", "possessive_pron": "theirs", "reflexive": "themselves"},
    "it":   {"subject": "it",   "object": "it",   "possessive_det": "its",   "possessive_pron": "its",    "reflexive": "itself"},
}


def _parse_target_subject(pronouns: str) -> str | None:
    """Return the subject pronoun key from 'they/them', 'she/her', etc."""
    first = pronouns.strip().split("/")[0].lower()
    return first if first in _TARGET_SETS else None


def _preserve_case(original: str, replacement: str) -> str:
    """Apply the case pattern of `original` to `replacement`."""
    if original.isupper():
        return replacement.upper()
    if original[0].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement


# ---------------------------------------------------------------------------
# Conjugation fixing — targeted regex for irregular verbs
# ---------------------------------------------------------------------------

# (subject_lower, bad_verb_lower) → correct_verb
# Covers the cases that arise when switching pronoun plurality
_CONJUGATION_FIXES: dict[str, list[tuple[str, str]]] = {
    # switching TO they/them (plural): singular verb forms → plural
    "they": [
        ("was",   "were"),
        ("is",    "are"),
        ("has",   "have"),
        ("does",  "do"),
    ],
    # switching TO she/her or he/him (singular): plural verb forms → singular
    "she": [
        ("were",  "was"),
        ("are",   "is"),
        ("have",  "has"),
        ("do",    "does"),
    ],
    "he": [
        ("were",  "was"),
        ("are",   "is"),
        ("have",  "has"),
        ("do",    "does"),
    ],
}


def _fix_conjugation(text: str, target_subject: str) -> str:
    """
    Fix irregular verb conjugation after pronoun substitution.
    Only handles the specific (pronoun)(verb) pattern — conservative to avoid
    touching verbs that belong to other subjects.
    """
    fixes = _CONJUGATION_FIXES.get(target_subject, [])
    for bad, good in fixes:
        # Match: the new subject pronoun immediately before the bad verb form
        # (with optional whitespace/punctuation between)
        pattern = rf'\b({re.escape(target_subject)})\s+({re.escape(bad)})\b'

        def replacer(m: re.Match, good=good) -> str:
            subj = m.group(1)
            verb = m.group(2)
            return subj + " " + _preserve_case(verb, good)

        text = re.sub(pattern, replacer, text, flags=re.IGNORECASE)
    return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_pronoun_proposals(
    instances: list[dict],
    plain_text: str,
    new_pronouns: str,
) -> list[dict]:
    """
    Given LLM-identified pronoun instances and the scene plain text,
    compute deterministic proposals: {original, rewritten, explanation,
    char_offset, word_type}.

    The LLM identified the phrases; this function computes what they become
    using the substitution table. No prose is generated.
    """
    target_subject = _parse_target_subject(new_pronouns)
    if not target_subject:
        return []

    target_table = _TARGET_SETS[target_subject]
    proposals: list[dict] = []

    for inst in instances:
        exact_text: str = inst.get("exact_text", "").strip()
        target_word: str = inst.get("target_word", "").strip()
        word_type: str = inst.get("word_type", "object")

        if not exact_text or not target_word:
            continue

        # Verify the phrase actually exists verbatim in the text
        if exact_text not in plain_text:
            continue

        # Gendered nouns (the man, the woman) — skip, no lookup table for these
        if word_type == "gendered_noun":
            continue

        replacement_lower = target_table.get(word_type)
        if replacement_lower is None:
            continue

        # Already using target pronoun — skip
        if target_word.lower() == replacement_lower:
            continue

        replacement = _preserve_case(target_word, replacement_lower)

        # Replace target_word within the exact_text phrase (word-boundary aware)
        pattern = r'\b' + re.escape(target_word) + r'\b'
        rewritten_phrase = re.sub(pattern, replacement, exact_text, count=1)

        if rewritten_phrase == exact_text:
            continue

        proposals.append({
            "original": exact_text,
            "rewritten": rewritten_phrase,
            "explanation": f"{target_word} → {replacement}",
            "char_offset": plain_text.index(exact_text),
            "word_type": word_type,
        })

    return proposals


def apply_proposals_to_html(
    html: str,
    proposals: list[dict],
    new_pronouns: str,
) -> str:
    """
    Apply selected proposals to scene HTML content, then fix conjugation.

    Proposals contain 6–10 word context phrases that don't span HTML tags,
    so direct string replacement is safe. Conjugation is fixed with a
    targeted regex pass afterward.
    """
    target_subject = _parse_target_subject(new_pronouns)

    # Sort by char_offset descending so earlier replacements don't shift later ones.
    # (char_offset is in plain-text space; for HTML it's an approximation, but
    # phrase ordering is still correct since HTML overhead is additive.)
    sorted_props = sorted(proposals, key=lambda p: p.get("char_offset", 0), reverse=True)

    for prop in sorted_props:
        original: str = prop["original"]
        rewritten: str = prop["rewritten"]
        if original in html:
            html = html.replace(original, rewritten, 1)

    # Fix conjugation (e.g. "They was" → "They were")
    if target_subject:
        html = _fix_conjugation(html, target_subject)

    return html


# ---------------------------------------------------------------------------
# Lazy spaCy loader — used for future NLP features (NER, POV drift, etc.)
# ---------------------------------------------------------------------------

_nlp = None


def get_nlp():
    """Load spaCy en_core_web_sm on first use. Shared across requests."""
    global _nlp
    if _nlp is None:
        import spacy
        _nlp = spacy.load("en_core_web_sm")
    return _nlp
