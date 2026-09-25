#!/usr/bin/env python3
"""Design-token budget: a value written into a component is a value no theme can change.

Every palette lives in `frontend/src/themes/*.css` and reaches components as a
`var(--color-*)` token, which is what makes eight themes and dark mode possible
and what `themes/contrast.test.ts` checks. A hex literal in a component
stylesheet opts out of all of it, silently — the same colour in every theme, and
invisible to the contrast gate.

Two things fail here.

1. Hex literals in component stylesheets. A ratchet, like the file-length budget:
   files that had them when the gate went in are recorded in HARDCODED with the
   count they had. They may shrink; they may not grow. Every other file must have
   none.

2. `var(--token)` where nothing defines `--token`. These look correct, which is why
   they survive review. With a fallback, the fallback quietly becomes the value and
   the rule stops following the palette — `--color-error` hid 23 unthemed reds that
   way. Without one, the declaration is invalid at computed-value time and the
   browser drops it, so the rule does nothing at all: `--color-text-secondary` is a
   near-miss for `--color-text-muted`, and 48 rules using it were dead. The 161
   references in the tree when this went in are all resolved; the lock is empty.

Usage:
    python3 scripts/check-tokens.py            # check
    python3 scripts/check-tokens.py --update   # reprint both debt blocks
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"

#: Palettes live here: this is the one place a raw colour belongs.
THEME_DIR = SRC / "themes"

HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
DEFINITION = re.compile(r"(--[a-z0-9-]+)\s*:")
REFERENCE = re.compile(r"var\(\s*(--[a-z0-9-]+)")
#: Custom properties are also set from TSX style props (`--beat-color`, and friends).
TSX_DEFINITION = re.compile(r"""["'](--[a-z0-9-]+)["']\s*:""")

#: References to a token nothing defines, locked per file. There were 161 when this gate
#: went in — near-misses like --color-text-secondary for --color-text-muted, so the rules
#: were dead rather than merely off-palette — and all were mapped to the token they meant.
#: Empty now: a new one fails at once.
UNDEFINED: dict[str, int] = {}

#: Component stylesheets carrying hex literals when this gate went in, locked at the
#: count they had. Sorted worst first: the top of this list is the work. Lower a
#: number when a file loses one; delete the line at zero. Never raise one.
HARDCODED: dict[str, int] = {
    "frontend/src/components/help/MICEGuide.module.css": 9,
    "frontend/src/components/characters/relationships/RelationshipMatrixView.module.css": 4,
    "frontend/src/components/twists/ReaderKnowledgeTimeline.module.css": 4,
    "frontend/src/components/ai/modes/AudienceAdherenceMode.module.css": 3,
    "frontend/src/components/ai/modes/ShowDontTellMode.module.css": 3,
    "frontend/src/components/characters/relationships/ValidationWarnings.module.css": 3,
    "frontend/src/components/compendium/CompendiumEntryDetail.module.css": 3,
    "frontend/src/components/compendium/CompendiumPanel.module.css": 3,
    "frontend/src/components/editor/SceneEditor.module.css": 3,
    "frontend/src/components/import/StructureReviewStep.module.css": 3,
    "frontend/src/components/story/TodoListView.module.css": 3,
    "frontend/src/components/characters/relationships/StrengthSliders.module.css": 2,
    "frontend/src/components/media/AssetPicker.module.css": 2,
    "frontend/src/components/story/StoryboardView.module.css": 2,
    "frontend/src/pages/WhatIfPage.module.css": 2,
    "frontend/src/components/ai/modes/ClicheCoachMode.module.css": 1,
    "frontend/src/components/ai/modes/DiscoveryQuestionsMode.module.css": 1,
    "frontend/src/components/help/EssentialQuestionsGuide.module.css": 1,
    "frontend/src/components/import/ImportWizard.module.css": 1,
    "frontend/src/components/media/MediaLibrary.module.css": 1,
    "frontend/src/components/media/PortraitEditor.module.css": 1,
    "frontend/src/components/outline/ExtractOutlinePanel.module.css": 1,
    "frontend/src/components/story/SummaryOverviewView.module.css": 1,
}


def component_styles() -> list[Path]:
    return sorted(p for p in SRC.rglob("*.css") if THEME_DIR not in p.parents)


def defined_tokens() -> set[str]:
    tokens: set[str] = set()
    for path in SRC.rglob("*.css"):
        tokens |= set(DEFINITION.findall(path.read_text()))
    for suffix in ("*.ts", "*.tsx"):
        for path in SRC.rglob(suffix):
            tokens |= set(TSX_DEFINITION.findall(path.read_text()))
    return tokens


def count_hex() -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in component_styles():
        n = len(HEX.findall(path.read_text()))
        if n:
            counts[str(path.relative_to(ROOT))] = n
    return counts


def count_undefined() -> dict[str, int]:
    """References per file to a token that nothing defines."""
    tokens = defined_tokens()
    counts: dict[str, int] = {}
    for path in SRC.rglob("*.css"):
        n = sum(1 for token in REFERENCE.findall(path.read_text()) if token not in tokens)
        if n:
            counts[str(path.relative_to(ROOT))] = n
    return counts


def ratchet(counts: dict[str, int], locks: dict[str, int], what: str, fix: str) -> tuple[list[str], list[str]]:
    problems: list[str] = []
    notes: list[str] = []
    for rel, allowed in sorted(locks.items()):
        actual = counts.get(rel, 0)
        if actual > allowed:
            problems.append(f"{rel}: {actual} {what}, up from its lock of {allowed}. {fix}")
        elif actual < allowed:
            notes.append(
                f"{rel}: {actual} {what}, down from {allowed}"
                + (" — none left, delete its line." if actual == 0 else " — lower its lock.")
            )
    for rel, actual in sorted(counts.items()):
        if rel not in locks:
            problems.append(f"{rel}: {actual} {what}. {fix}")
    return problems, notes


def main() -> int:
    hexes, undefined = count_hex(), count_undefined()

    if "--update" in sys.argv:
        for name, counts in (("HARDCODED", hexes), ("UNDEFINED", undefined)):
            print(f"{name}: dict[str, int] = {{")
            locks = HARDCODED if name == "HARDCODED" else UNDEFINED
            for rel, n in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f'    "{rel}": {min(n, locks.get(rel, n))},')
            print("}\n")
        return 0

    problems, notes = ratchet(hexes, HARDCODED, "hex colours", "Themes cannot reach these — use a var(--color-*) token.")
    more, extra = ratchet(
        undefined,
        UNDEFINED,
        "references to undefined tokens",
        "Nothing defines them, so the rule silently does nothing.",
    )
    problems += more
    notes += extra

    for note in notes:
        print(f"  · {note}")
    if problems:
        print("\nDesign-token budget:\n")
        for problem in problems:
            print(f"  ✗ {problem}")
        print(f"\n{len(problems)} problem(s). `--update` reprints both debt blocks.")
        return 1

    print(
        f"Design-token budget: {sum(HARDCODED.values())} hex colours and "
        f"{sum(UNDEFINED.values())} undefined-token references on the debt list."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
