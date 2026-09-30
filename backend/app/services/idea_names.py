"""Names in the author's brain dump that the story does not know yet (doc 10 P2).

spaCy's entity recogniser, the same model the Discoveries page uses: deterministic, no
LLM, so the suggestions show in Writer mode too. People become character suggestions;
places, buildings and regions become place suggestions. Names the story already has,
by full name or any part of it, are left out.
"""

import re

from .nlp_analysis_service import get_nlp

PERSON = {"PERSON"}
PLACE = {"GPE", "LOC", "FAC"}


def _known_forms(names: list[str]) -> set[str]:
    forms: set[str] = set()
    for name in names:
        plain = re.sub(r"\([^)]*\)", " ", name)
        forms.add(" ".join(plain.split()).lower())
        forms.update(p.lower() for p in re.findall(r"\(([^)]+)\)", name))
        forms.update(w.lower() for w in plain.split() if len(w) > 2)
    return forms


def _capital_runs(span) -> list[str]:
    runs: list[list[str]] = [[]]
    for token in span:
        if token.text[:1].isupper():
            runs[-1].append(token.text)
        elif runs[-1]:
            runs.append([])
    return [" ".join(r) for r in runs if r]


def idea_names(texts: dict[str, str], known: list[str]) -> dict[str, list[dict[str, str]]]:
    """For each fragment id, the people and places named in it that the story lacks."""
    nlp = get_nlp()
    skip = _known_forms(known)
    out: dict[str, list[dict[str, str]]] = {}
    for fid, text in texts.items():
        doc = nlp(text)
        candidates: list[tuple[str, str]] = []
        for ent in doc.ents:
            kind = "character" if ent.label_ in PERSON else "place" if ent.label_ in PLACE else None
            if kind:
                # The model can swallow a verb between two names ("Eleanor Vance meets
                # Calder" as one person): keep only runs of capitalised words.
                candidates.extend((run, kind) for run in _capital_runs(ent))
        # The small model misses a lone name that opens a sentence ("Nell runs the ferry"),
        # which is how brain-dump notes start. Runs of proper nouns it did not place count as
        # people, the likelier case; the author can file one as a place instead.
        # Only tokens already claimed as a person or place; the model calls a lone "Nell" an
        # organisation.
        in_ents = {t.i for ent in doc.ents if ent.label_ in PERSON | PLACE for t in ent}
        run: list[str] = []
        for token in [*doc, None]:
            # Capitalised only: the tagger sometimes calls a verb between two names a PROPN.
            if token is not None and token.pos_ == "PROPN" and token.text[:1].isupper() and token.i not in in_ents:
                run.append(token.text)
                continue
            if run:
                candidates.append((" ".join(run), "character"))
                run = []
        found: list[dict[str, str]] = []
        seen: set[str] = set()
        for raw, kind in candidates:
            name = re.sub(r"^(?:the|a|an)\s+", "", raw.strip(" '’\"“”.,;:"), flags=re.IGNORECASE)
            if not name or name.lower() in skip or name.lower() in seen:
                continue
            seen.add(name.lower())
            found.append({"name": name, "kind": kind})
        out[fid] = found
    return out
