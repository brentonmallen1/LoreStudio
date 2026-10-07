#!/usr/bin/env python3
"""
Render the AI feature table into TypeScript.

`app/services/llm/features.py` is the source of truth (refactor doc 06 §1). This script
writes `frontend/src/lib/ai/features.generated.ts` so the panel, palette, Chronicle and
settings cards read the same rows the gateway logs against.

    uv run python scripts/gen_ai_features.py           # write the file
    uv run python scripts/gen_ai_features.py --check   # fail if it is out of date (CI)

The generated file is in .prettierignore: this script owns its formatting.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.llm.features import (  # noqa: E402
    AI_FEATURES,
    CLASS_DESCRIPTIONS,
    CLASS_LABELS,
    GROUP_LABELS,
)

OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "ai" / "features.generated.ts"

HEADER = """/**
 * Generated from backend/app/services/llm/features.py — do not edit by hand.
 * Run `just gen` after changing the table; CI fails when this file is stale.
 */
"""


def ts(value: str) -> str:
    """A TypeScript double-quoted string literal."""
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def union(values: list[str]) -> str:
    return " | ".join(ts(v) for v in values)


def record(name: str, key_type: str, mapping: dict[str, str]) -> str:
    lines = [f"export const {name}: Record<{key_type}, string> = {{"]
    lines += [f"  {ts(k)}: {ts(v)}," for k, v in mapping.items()]
    lines.append("};")
    return "\n".join(lines)


def build() -> str:
    groups = list(GROUP_LABELS)
    classes = list(CLASS_LABELS)

    parts = [
        HEADER,
        f"export type AIFeatureGroup = {union(groups)};",
        "",
        f"export type AIFeatureClass = {union(classes)};",
        "",
        "export interface AIFeatureRow {",
        "  id: string;",
        "  label: string;",
        "  group: AIFeatureGroup;",
        "  /** What the model is allowed to hand back (the co-author contract). */",
        "  classification: AIFeatureClass;",
        "  description: string;",
        "  /** What gets sent, in the author's words. */",
        "  context: string[];",
        "  /** num_ctx budget in tokens, capped at call time by the model and the user ceiling. */",
        "  budget: number;",
        '  /** Gemma reasons before answering under Settings\' "Where it helps". */',
        "  thinks: boolean;",
        "}",
        "",
        record("AI_FEATURE_GROUP_LABELS", "AIFeatureGroup", GROUP_LABELS),
        "",
        record("AI_FEATURE_CLASS_LABELS", "AIFeatureClass", CLASS_LABELS),
        "",
        record("AI_FEATURE_CLASS_DESCRIPTIONS", "AIFeatureClass", CLASS_DESCRIPTIONS),
        "",
        "export const AI_FEATURES: AIFeatureRow[] = [",
    ]

    for f in AI_FEATURES:
        context = ", ".join(ts(c) for c in f.context)
        parts += [
            "  {",
            f"    id: {ts(f.id)},",
            f"    label: {ts(f.label)},",
            f"    group: {ts(f.group)},",
            f"    classification: {ts(f.classification)},",
            f"    description: {ts(f.description)},",
            f"    context: [{context}],",
            f"    budget: {f.budget},",
            f"    thinks: {'true' if f.thinks_first else 'false'},",
            "  },",
        ]

    parts += [
        "];",
        "",
        "export const AI_FEATURES_BY_ID: Record<string, AIFeatureRow> = Object.fromEntries(",
        "  AI_FEATURES.map((f) => [f.id, f]),",
        ");",
        "",
        "/** Label for a feature id; unknown ids are title-cased so nothing renders raw. */",
        "export function aiFeatureLabel(id: string): string {",
        "  const feature = AI_FEATURES_BY_ID[id];",
        "  if (feature) return feature.label;",
        '  return id.replace(/[-_]/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase());',
        "}",
        "",
    ]
    return "\n".join(parts)


def main() -> int:
    content = build()
    if "--check" in sys.argv:
        current = OUT.read_text() if OUT.exists() else ""
        if current != content:
            print(f"{OUT} is out of date — run `just gen`", file=sys.stderr)
            return 1
        print(f"{OUT.name} is up to date ({len(AI_FEATURES)} features)")
        return 0
    OUT.write_text(content)
    print(f"wrote {OUT} ({len(AI_FEATURES)} features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
