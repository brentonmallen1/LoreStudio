"""Where each piece of a Novelcrafter export goes by default (doc 28), and what has no place.

The author sees every default in the wizard's What comes over step and can change any of it;
an entry with no clear home waits in Proposals › Imported ("later") rather than being guessed.
"""

from __future__ import annotations

import re

from ...schemas.import_novelcrafter import (
    EntryTarget,
    FacetField,
    LeftOut,
    NcChat,
    NcEntry,
    NcEntryChoice,
    NcSnippet,
    NovelcrafterChoices,
    NovelcrafterPreview,
    SnippetTarget,
)
from .reader import Entry, Export

#: "Richard (Physical)": a facet of Richard, by the word in brackets.
_FACET = re.compile(r"^(?P<base>.+?)\s*\((?P<label>[^()]+)\)\s*$")
FACET_FIELDS: dict[str, FacetField] = {
    "physical": "appearance",
    "appearance": "appearance",
    "looks": "appearance",
    "body": "appearance",
    "communication": "speech_patterns",
    "speech": "speech_patterns",
    "voice": "speech_patterns",
    "dialogue": "speech_patterns",
    "emotion": "thinking",
    "emotions": "thinking",
    "psychology": "thinking",
    "mind": "thinking",
    "inner life": "thinking",
    "biography": "background",
    "backstory": "background",
    "history": "background",
    "background": "background",
    "personality": "personality",
}
#: Tags that say what a character is: they become the role or the archetype, not lost tags.
ROLE_TAGS = {
    "protagonist": ("role", "protagonist"),
    "antagonist": ("role", "antagonist"),
    "deuteragonist": ("role", "deuteragonist"),
    "foil": ("role", "foil"),
    "confidant": ("role", "confidant"),
    "love interest": ("role", "love_interest"),
    "hero": ("jungian_archetype", "hero"),
    "mentor": ("jungian_archetype", "sage"),
}
TROPE_TAGS = {"trope", "tropes"}
THEME_TAGS = {"theme", "themes"}
DEFAULT_TARGETS: dict[str, EntryTarget] = {"character": "character", "location": "location", "subplot": "thread"}

NOT_IN_FILE = [
    "Scene summaries, labels and POV",
    "Codex progressions and relations between entries",
    "Which entries appear in which scenes",
    "Which scenes each subplot runs through",
]

#: Destinations with a tags column of their own; anywhere else an entry's tags have no place.
TAGGED_TARGETS = {"compendium", "later"}


def norm(text: str) -> str:
    """A name for comparing: lower case, no punctuation, no "No." ("Station No. 17" is
    "station 17")."""
    words = re.sub(r"[^\w\s]", " ", text.lower()).split()
    return " ".join(w for w in words if w != "no")


def _keys(e: Entry) -> set[str]:
    return {norm(e.name), *(norm(a) for a in e.aliases)} - {""}


def _parts(e: Entry) -> set[str]:
    return {norm(p) for p in re.split(r"[:–—]", e.name) if norm(p)}


def _tags(e: Entry) -> set[str]:
    return {t.strip().lower() for t in e.tags}


def find_character(base: str, characters: list[Entry]) -> Entry | None:
    """The character "Richard" or "John B." names: by name or another name first, then by the
    first word of a name when only one character has it."""
    key = norm(base)
    exact = [c for c in characters if key in _keys(c)]
    if len(exact) == 1:
        return exact[0]
    first = [c for c in characters if norm(c.name).split()[:1] == key.split()[:1] and len(key.split()) == 1]
    return first[0] if len(first) == 1 else None


def facet_of(e: Entry, characters: list[Entry], nested_in: dict[str, Entry]) -> tuple[Entry, FacetField] | None:
    """The character this entry is a facet of, and the field it folds into."""
    if e.type == "character":
        return None
    m = _FACET.match(e.name)
    label = m.group("label").strip().lower() if m else ""
    parent = nested_in.get(e.id)
    if parent is None and m:
        parent = find_character(m.group("base"), characters)
    if parent is None or parent.type != "character":
        return None
    return parent, FACET_FIELDS.get(label, "note")


def _default(e: Entry) -> EntryTarget:
    tags = _tags(e)
    if tags & TROPE_TAGS:
        return "trope"
    if tags & THEME_TAGS:
        return "theme"
    return DEFAULT_TARGETS.get(e.type, "later")


def _excerpt(text: str, n: int = 160) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= n else flat[: n - 1].rstrip() + "…"


def _clashes(entries: list[Entry], skip: set[str]) -> dict[str, tuple[Entry, str]]:
    """For an entry that looks like another (the same name, or a name the other goes by), that
    other and a sentence saying so. The entry with no home of its own carries the warning."""
    rank = {"character": 0, "location": 0, "subplot": 1}
    out: dict[str, tuple[Entry, str]] = {}
    live = [e for e in entries if e.id not in skip]
    for e in live:
        best: tuple[int, Entry] | None = None
        for other in live:
            if other is e or rank.get(other.type, 2) > rank.get(e.type, 2):
                continue
            if rank.get(other.type, 2) == rank.get(e.type, 2) and other.id < e.id and other.id in out:
                continue
            score = len(_parts(e) & _keys(other)) + (norm(e.name) in _keys(other))
            if score and (best is None or score > best[0]):
                best = (score, other)
        if best is not None and best[1].id not in out:
            other = best[1]
            out[e.id] = (other, f"{e.name} looks like {other.name}")
    return out


def propose(export: Export, *, looks_like_screenplay: bool = False, author: str | None = None) -> NovelcrafterPreview:
    characters = [e for e in export.entries if e.type == "character"]
    nested_in = {child: e for e in export.entries for child in e.nested}

    rows: list[NcEntry] = []
    facets: set[str] = set()
    for e in export.entries:
        target = _default(e)
        fold = facet_of(e, characters, nested_in)
        facet_owner, facet_field = (fold[0].id, fold[1]) if fold else (None, None)
        if fold and target == "later":
            target = "facet"
            facets.add(e.id)
        rows.append(
            NcEntry(
                id=e.id,
                origin=e.origin,
                type=e.type,
                name=e.name,
                aliases=e.aliases,
                tags=e.tags,
                excerpt=_excerpt(e.body or e.notes),
                has_notes=bool(e.notes),
                has_thumbnail=e.thumbnail is not None,
                urls=len(e.urls),
                target=target,
                facet_of=facet_owner,
                facet_field=facet_field,
            )
        )
    for row in rows:
        clash = _clashes(export.entries, facets).get(row.id)
        if clash:
            row.clash_with, row.clash_text = clash[0].id, clash[1]

    snippets = [
        NcSnippet(id=s.id, origin=s.origin, title=s.title, excerpt=_excerpt(s.body), target=_snippet_default(s))
        for s in export.snippets
    ]
    chats = [
        NcChat(id=c.id, origin=c.origin, title=c.title or _excerpt(c.turns[0][1], 70), date=c.date, turns=len(c.turns))
        for c in export.chats
    ]
    no_place, nothing = left_out(export, {r.id: NcEntryChoice(target=r.target) for r in rows})
    return NovelcrafterPreview(
        entries=rows,
        snippets=snippets,
        chats=chats,
        no_place=no_place,
        nothing_set=nothing,
        not_in_file=NOT_IN_FILE,
        author=author,
        looks_like_screenplay=looks_like_screenplay,
    )


_URL_ONLY = re.compile(r"^\s*https?://\S+\s*$")


def _snippet_default(s) -> SnippetTarget:
    if s.title.strip().lower() == "logline":
        return "logline"
    if _URL_ONLY.match(s.body):
        return "compendium"
    return "note"


def resolve(preview: NovelcrafterPreview, choices: NovelcrafterChoices) -> tuple[dict, dict]:
    """Each entry's and snippet's final choice: the author's where they made one, else the
    default the wizard showed."""
    entries = {
        r.id: choices.entries.get(r.id)
        or NcEntryChoice(target=r.target, facet_of=r.facet_of, facet_field=r.facet_field)
        for r in preview.entries
    }
    snippets = {s.id: choices.snippets.get(s.id, s.target) for s in preview.snippets}
    return entries, snippets


def left_out(export: Export, entries: dict[str, NcEntryChoice]) -> tuple[list[LeftOut], list[str]]:
    """What in the file has nowhere to go, given where each entry goes; and the kinds of thing
    that were never set, so the author reads that nothing is lost there."""
    out: list[LeftOut] = []
    nothing: list[str] = []

    lost_tags: dict[str, list[str]] = {}
    for e in export.entries:
        choice = entries.get(e.id)
        if choice is None or choice.target in TAGGED_TARGETS or choice.target == "skip":
            continue
        used = (TROPE_TAGS | THEME_TAGS | set(ROLE_TAGS)) if e.type == "character" else (TROPE_TAGS | THEME_TAGS)
        for tag in e.tags:
            if tag.strip().lower() not in used:
                lost_tags.setdefault(tag, []).append(e.name)
    if lost_tags:
        names = {n for ns in lost_tags.values() for n in ns}
        out.append(
            LeftOut(
                what=f"Tags {', '.join(sorted(lost_tags))}",
                why="Lorebook entries don't have tags yet. They are kept in the import record.",
                count=len(names),
                examples=sorted(names)[:4],
            )
        )

    colored = [e.name for e in export.entries if e.color]
    flagged = [e.name for e in export.entries if any(e.flags.values())]
    favourites = [s.title or s.id for s in export.snippets if s.favourite]
    for items, what, why in (
        (colored, "Colors", "LoreStudio colors an entry from its palette. Pick one on its sheet."),
        (
            flagged,
            "AI settings (always include, don't track)",
            "LoreStudio brings an entry into the Assistant when the scene names it.",
        ),
        (favourites, "Favorite snippets", "Notes have no favorite. Their notes say which they were."),
    ):
        if items:
            out.append(LeftOut(what=what, why=why, count=len(items), examples=items[:4]))
        else:
            nothing.append(what)
    if not any(e.fields for e in export.entries):
        nothing.append("Custom fields")
    if export.has_codex_html:
        out.append(
            LeftOut(
                what="A printable copy of the codex (codex.html)",
                why="The same entries again, laid out to print: nothing in it is new.",
                count=1,
            )
        )
    return out, nothing
