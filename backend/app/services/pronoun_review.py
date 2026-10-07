"""
The review step, Quick (doc 20 P3): when a character's pronouns or name change, the sentences
that should follow, found on this machine and offered one by one. Nothing is written here;
`routers/character_review.py` applies what the author ticks.

Built on what the local stack has (spaCy ``en_core_web_sm``: tagger and dependency parse, no
coreference). For each scene the character is on the page of:

- every pronoun of the old set, its word type from the parse ("her book" is possessive, "to her"
  an object), rewritten in the new set, with the verb it governs made to agree inside that
  sentence only ("she was" → "they were", "they walk" → "she walks");
- **Sure** when the character is the only one on the page with the old set, or the nearest
  person with that set named before it (same or previous sentence) is them; **Unsure**
  otherwise, inside dialogue, and for "they" (which may be plural) unless named;
- gendered words near them ("the woman", "Mrs"), listed with no rewrite: there is no right
  replacement to compute;
- every use of the old name, the plain-text ones a rename used to miss included.

What it misses is said in the review's ⓘ (frontend lib/characters/review.ts).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .codex.presence import name_patterns
from .pronoun_service import _preserve_case, get_nlp
from .prose_html import paragraphs
from .prose_rewrite import _syntax_ranges, _uses, find_in_text
from .prose_syntax import find_quotes, find_speaker_tags

#: Pronoun sets by their subject word: subject, object, possessive before a noun, possessive
#: on its own, reflexive.
SETS: dict[str, dict[str, str]] = {
    "she": {"subject": "she", "object": "her", "poss_det": "her", "poss_pron": "hers", "reflexive": "herself"},
    "he": {"subject": "he", "object": "him", "poss_det": "his", "poss_pron": "his", "reflexive": "himself"},
    "they": {
        "subject": "they",
        "object": "them",
        "poss_det": "their",
        "poss_pron": "theirs",
        "reflexive": "themselves",
    },
    "xe": {"subject": "xe", "object": "xem", "poss_det": "xyr", "poss_pron": "xyrs", "reflexive": "xemself"},
    "ze": {"subject": "ze", "object": "hir", "poss_det": "hir", "poss_pron": "hirs", "reflexive": "hirself"},
    "it": {"subject": "it", "object": "it", "poss_det": "its", "poss_pron": "its", "reflexive": "itself"},
}

#: Words that name a gender and have no computed replacement: listed for the author.
GENDERED = {
    "woman", "women", "girl", "girls", "lady", "ladies", "ma'am", "madam", "mrs", "miss", "ms",
    "sister", "mother", "daughter", "wife", "aunt", "niece", "grandmother", "widow", "queen",
    "man", "men", "boy", "boys", "gentleman", "sir", "mr", "brother", "father", "son", "husband",
    "uncle", "nephew", "grandfather", "widower", "king",
}  # fmt: skip

_TO_PLURAL = {"was": "were", "is": "are", "has": "have", "does": "do"}
_TO_SINGULAR = {"were": "was", "are": "is", "have": "has", "do": "does"}


def pronoun_set(pronouns: str) -> str | None:
    """The set a written value names ("she/her" → "she"), or None ("any pronouns", "name only")."""
    first = re.split(r"[/\s,]+", (pronouns or "").strip().lower(), maxsplit=1)[0]
    return first if first in SETS else None


def _third_person(lemma: str) -> str:
    if lemma == "have":
        return "has"
    if re.search(r"(s|sh|ch|x|z|o)$", lemma):
        return lemma + "es"
    if re.search(r"[^aeiou]y$", lemma):
        return lemma[:-1] + "ies"
    return lemma + "s"


def _agree(verb: Any, plural: bool) -> str | None:
    """The verb form that agrees with the new subject, or None when it already does."""
    word, low = verb.text, verb.text.lower()
    if low in ("'s", "’s"):
        return (f"{word[0]}ve" if verb.lemma_ == "have" else f"{word[0]}re") if plural else None
    if low in ("'re", "’re", "'ve", "’ve"):
        return None if plural else f"{word[0]}s"
    table = _TO_PLURAL if plural else _TO_SINGULAR
    if low in table:
        return _preserve_case(word, table[low])
    if plural and verb.tag_ == "VBZ":
        return _preserve_case(word, verb.lemma_.lower())
    if not plural and verb.tag_ == "VBP":
        return _preserve_case(word, _third_person(verb.lemma_.lower()))
    return None


def _word_type(token: Any, set_key: str) -> str | None:
    """Which word of the set this token is, from the parse where one word is two ("her")."""
    low = token.text.lower()
    matches = [k for k, w in SETS[set_key].items() if w == low]
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    if set(matches) >= {"object", "poss_det"} or set(matches) >= {"poss_det", "poss_pron"}:
        following = token.nbor(1) if token.i + 1 < len(token.doc) else None
        if token.tag_ == "PRP$" or (following is not None and following.pos_ in ("NOUN", "ADJ", "PROPN", "NUM")):
            return "poss_det"
        return "object" if "object" in matches else "poss_pron"
    if set(matches) >= {"subject", "object"}:  # "it"
        return "subject" if token.dep_ in ("nsubj", "nsubjpass", "expl") else "object"
    return matches[0]


def _governed_verb(token: Any) -> Any | None:
    """The verb a subject pronoun agrees with: its first auxiliary, else its head, after it."""
    if token.dep_ not in ("nsubj", "nsubjpass"):
        return None
    head = token.head
    candidates = [c for c in head.children if c.dep_ in ("aux", "auxpass") and c.i > token.i]
    if head.i > token.i and head.pos_ in ("VERB", "AUX"):
        candidates.append(head)
    return min(candidates, key=lambda t: t.i) if candidates else None


@dataclass
class Edit:
    start: int
    end: int
    text: str
    was: str


@dataclass
class Proposal:
    node_id: str
    para: int
    kind: str  # "pronoun" | "gendered" | "name"
    sure: bool
    sent_start: int
    sent_end: int
    before: str
    edits: list[Edit] = field(default_factory=list)
    note: str = ""

    @property
    def id(self) -> str:
        first = self.edits[0].start if self.edits else self.sent_start
        return f"{self.node_id}:{self.para}:{first}:{self.kind}"

    @property
    def after(self) -> str:
        text = self.before
        for e in sorted(self.edits, key=lambda e: e.start, reverse=True):
            a, b = e.start - self.sent_start, e.end - self.sent_start
            text = text[:a] + e.text + text[b:]
        return text


def _masked(text: str) -> str:
    """The paragraph with its syntax (speaker tags, a mention's @, a place's brackets) blanked,
    same length, so the parse reads prose and every offset still points into the text."""
    chars = list(text)
    for a, b in _syntax_ranges(text):
        for i in range(a, b):
            chars[i] = " "
    return "".join(chars)


def _quoted(text: str) -> list[tuple[int, int]]:
    spans = [(q.start, q.end) for q in find_quotes(text)]
    spans += [(t.quote_start, t.tag_start) for t in find_speaker_tags(text)]
    return spans


@dataclass
class Person:
    id: str
    set_key: str | None


def review_scene(
    node_id: str,
    html: str,
    me: Any,
    *,
    old_set: str | None,
    new_set: str | None,
    on_page: list[Person],
    patterns: dict[str, list[re.Pattern[str]]],
    named_only: bool = False,
    old_name: str = "",
    new_name: str = "",
) -> list[Proposal]:
    """Proposals for one scene. ``named_only`` (a review for slips) offers a pronoun only where
    the nearest person with that set named before it is them."""
    out: list[Proposal] = []
    same_set = {p.id for p in on_page if p.set_key == old_set and p.id != me.id}
    nlp = get_nlp() if old_set and new_set else None
    old_key, new_key = old_set or "", new_set or ""  # both set whenever nlp is
    previous_hits: list[tuple[int, str]] = []
    for pi, para in enumerate(paragraphs(html)):
        text = para.text
        if old_name and new_name:
            out += _name_proposals(node_id, pi, text, html, old_name, new_name)
        if nlp is None:
            continue
        doc = nlp(_masked(text))
        hits = sorted((m.start(), cid) for cid, pats in patterns.items() for p in pats for m in p.finditer(text))
        quoted = _quoted(text)
        sents = list(doc.sents)
        for si, sent in enumerate(sents):
            window = sents[si - 1].start_char if si > 0 else 0
            proposal = Proposal(node_id, pi, "pronoun", True, sent.start_char, sent.end_char, sent.text)
            unsure = False
            for tok in sent:
                kind = _word_type(tok, old_key) if tok.pos_ == "PRON" or tok.tag_.startswith("PRP") else None
                if kind is None:
                    continue
                before = [h for h in hits if window <= h[0] < tok.idx] or (previous_hits if si == 0 else [])
                named = [cid for _, cid in before if cid == me.id or cid in same_set]
                nearest_is_me = bool(named) and named[-1] == me.id
                if named_only and not nearest_is_me:
                    continue
                # "They" may be plural, so only a name before it makes it theirs.
                sure = nearest_is_me or (not same_set and old_set != "they")
                in_quote = any(a <= tok.idx < b for a, b in quoted)
                unsure = unsure or not sure or in_quote
                proposal.edits.append(
                    Edit(tok.idx, tok.idx + len(tok.text), _preserve_case(tok.text, SETS[new_key][kind]), tok.text)
                )
                verb = _governed_verb(tok) if kind == "subject" else None
                plural_now, plural_then = new_set == "they", old_set == "they"
                if verb is not None and plural_now != plural_then and verb.sent == sent:
                    if agreed := _agree(verb, plural_now):
                        proposal.edits.append(Edit(verb.idx, verb.idx + len(verb.text), agreed, verb.text))
            if proposal.edits:
                proposal.sure = not unsure
                out.append(proposal)
            gendered = [t for t in sent if t.text.lower().rstrip(".") in GENDERED]
            if gendered and any(sent.start_char <= h[0] < sent.end_char and h[1] == me.id for h in hits):
                words = ", ".join(dict.fromkeys(t.text for t in gendered))
                out.append(
                    Proposal(node_id, pi, "gendered", False, sent.start_char, sent.end_char, sent.text, note=words)
                )
        previous_hits = [h for h in hits if sents and h[0] >= sents[-1].start_char]
    return out


def _name_proposals(node_id: str, pi: int, text: str, html: str, old: str, new: str) -> list[Proposal]:
    """Every use of the old name in a paragraph: mentions, speaker tags and plain text."""
    marked = [(a, b) for i, _p, a, b in _uses(html, "character", old) if i == pi]
    plain = [
        (a, b)
        for a, b in find_in_text(text, old, case_sensitive=True, whole_word=True)
        if not any(a < y and x < b for x, y in marked)
    ]
    out = []
    for a, b in sorted(marked + plain):
        start = max(text.rfind(". ", 0, a) + 2, 0) if text.rfind(". ", 0, a) != -1 else 0
        end = text.find(". ", b)
        end = len(text) if end == -1 else end + 1
        out.append(Proposal(node_id, pi, "name", True, start, end, text[start:end], [Edit(a, b, new, text[a:b])]))
    return out


def people_on_page(
    scene_ids: list[str], on_page: dict[str, list[str]], characters: list[Any]
) -> dict[str, list[Person]]:
    by_id = {c.id: c for c in characters}
    return {
        sid: [Person(cid, pronoun_set(by_id[cid].pronouns)) for cid in on_page.get(sid, []) if cid in by_id]
        for sid in scene_ids
    }


def patterns_for(characters: list[Any]) -> dict[str, list[re.Pattern[str]]]:
    from .codex.presence import known_as

    return name_patterns({c.id: known_as(c) for c in characters})
