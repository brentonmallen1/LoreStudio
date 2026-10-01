"""Assistant runs as findings (doc 12 P3): one adapter per check, read from its latest run.

Results name scenes by title; the view resolves them. A finding that quotes a passage the
author has since rewritten is dropped. A feature with no adapter shows as one finding
pointing at the run, so nothing an analysis said is ever silently lost.
"""

from __future__ import annotations

from collections.abc import Callable

from ...models.activity_log import ActivityLog
from ...schemas.findings import Finding, FindingAnchor, FindingKind, Severity
from ..llm.features import get_feature
from .local import LOCAL_FEATURES
from .make import make, severity
from .runs import result_of
from .view import StoryView

#: Runs that are not findings: proposals (P5) and summaries.
NOT_FINDINGS = {"entity-suggestions", *LOCAL_FEATURES}


class _Run:
    """One run being read: builds its findings with the run's id, time and scene lookup."""

    def __init__(self, view: StoryView, log: ActivityLog, feature: str):
        self.view, self.log, self.feature = view, log, feature
        self.out: list[Finding] = []

    def add(
        self,
        kind: FindingKind,
        sev: str | None,
        text: str,
        *,
        scenes: list[str] | None = None,
        scene_id: str | None = None,
        passage: str = "",
        suggestion: str = "",
        evidence: str = "",
        character_id: str | None = None,
        where: str = "",
        default: Severity = "mid",
    ) -> None:
        text = (text or "").strip()
        if not text:
            return
        node = self.view.by_id.get(scene_id or "") or next(
            (n for n in (self.view.scene_named(s) for s in scenes or []) if n), None
        )
        if not self.view.still_there(node, passage):
            return
        anchor = FindingAnchor(node_id=node.id if node else None, character_id=character_id)
        if node:
            action, where = "open_scene", where or node.title or "Untitled scene"
        elif character_id:
            action = "open_sheet"
        else:
            action = "ask"
        self.out.append(
            make(
                self.feature,
                kind,
                severity(sev, default),
                "ai",
                text,
                anchor=anchor,
                evidence=passage or evidence,
                suggestion=(suggestion or "").strip(),
                where=where,
                action=action,
                run_id=self.log.id,
                feature=self.feature,
                created_at=self.log.created_at,
            )
        )


def _pacing(r: _Run, d: dict) -> None:
    for spot in d.get("slow_spots", []):
        r.add("structure", "moderate", f"Drags: {spot}", scenes=[spot])


def _continuity(r: _Run, d: dict) -> None:
    for i in d.get("issues", []):
        r.add(
            "continuity",
            i.get("severity"),
            i.get("description", ""),
            scenes=i.get("scene_references", []),
            evidence=i.get("explanation", ""),
            suggestion=i.get("suggestion", ""),
        )


def _plot_holes(r: _Run, d: dict) -> None:
    for h in d.get("holes", []):
        r.add(
            "continuity",
            h.get("severity"),
            h.get("description", ""),
            scenes=h.get("scene_references", []),
            evidence=h.get("explanation", ""),
            suggestion=h.get("suggestion", ""),
        )
    for gap in d.get("logic_gaps", []):
        r.add("continuity", "minor", gap, scenes=[gap])


def _dimensionality(r: _Run, d: dict) -> None:
    by_name = {(c.name or "").lower(): c for c in r.view.characters}
    for c in d.get("characters", []):
        score = c.get("dimension_score", "")
        if score not in ("flat", "developing"):
            continue
        char = next((x for x in r.view.characters if x.id == c.get("character_id")), None) or by_name.get(
            (c.get("character_name") or "").lower()
        )
        gaps = c.get("gaps") or []
        name = c.get("character_name") or (char.name if char else "A character")
        r.add(
            "cast",
            "moderate" if score == "flat" else "minor",
            f"{name} reads {score}" + (f": {gaps[0]}" if gaps else ""),
            character_id=char.id if char else None,
            suggestion=(c.get("recommendations") or [""])[0],
            where=name,
        )


def _cliches(r: _Run, d: dict) -> None:
    for cat in d.get("categories", []):
        for i in cat.get("instances", []):
            r.add(
                "prose",
                i.get("severity"),
                f"Cliché ({i.get('cliche_type') or cat.get('name', 'phrase')}): {i.get('explanation', '')}".rstrip(
                    ": "
                ),
                scene_id=i.get("scene_id"),
                scenes=[i.get("scene_title", "")],
                passage=i.get("passage", ""),
                suggestion=i.get("intentional_use_case", ""),
                default="low",
            )


def _themes(r: _Run, d: dict) -> None:
    for gap in d.get("gaps", []):
        r.add("meaning", "minor", gap)


def _first_pass(r: _Run, d: dict) -> None:
    for g in d.get("gaps", []):
        r.add(
            "meaning",
            g.get("severity"),
            g.get("finding", ""),
            scenes=g.get("scene_references", []),
            suggestion=g.get("suggestion", ""),
        )
    for setup in d.get("missed_setups", []):
        r.add("meaning", "minor", setup, scenes=[setup])


def _essential_questions(r: _Run, d: dict) -> None:
    for key in ("protagonist", "want", "why", "obstacle", "stakes", "change"):
        q = d.get(key) or {}
        if q.get("status") in ("unclear", "partial"):
            r.add(
                "meaning",
                "moderate" if q.get("status") == "unclear" else "minor",
                q.get("question") or key.capitalize(),
                evidence=q.get("evidence", ""),
                suggestion=q.get("recommendation", ""),
                where="Story identity",
            )


def _editorial(r: _Run, d: dict) -> None:
    for p in (d.get("priorities") or {}).get("priorities", []):
        r.add(
            "prose",
            p.get("impact"),
            p.get("issue", ""),
            scenes=[p.get("section_title", "")],
            passage=p.get("anchor", ""),
            suggestion=p.get("suggestion", ""),
        )
    for g in (d.get("intent_gaps") or {}).get("gaps", []):
        r.add(
            "meaning",
            "moderate",
            g.get("gap", ""),
            scenes=[g.get("section_title", "")],
            passage=g.get("anchor", ""),
            evidence=g.get("execution", ""),
            suggestion=g.get("suggestion", ""),
        )
    for q in (d.get("fresh_eyes") or {}).get("questions", []):
        r.add(
            "continuity",
            "minor",
            q.get("question", ""),
            scenes=[q.get("section_title", "")],
            passage=q.get("anchor", ""),
            evidence=q.get("context", ""),
        )


ADAPTERS: dict[str, Callable[[_Run, dict], None]] = {
    "pacing-analysis": _pacing,
    "continuity-check": _continuity,
    "plot-holes": _plot_holes,
    "character-dimensionality": _dimensionality,
    "cliche-analysis": _cliches,
    "theme-tracker": _themes,
    "first-pass": _first_pass,
    "essential-questions": _essential_questions,
    "editorial-pass": _editorial,
}


def is_check(feature: str) -> bool:
    """An Assistant check whose runs can hold findings (the Run checks menu lists these)."""
    spec = get_feature(feature)
    return feature not in NOT_FINDINGS and (
        feature in ADAPTERS or (spec is not None and spec.classification == "analyse")
    )


def to_findings(view: StoryView, feature: str, log: ActivityLog) -> list[Finding]:
    if feature in NOT_FINDINGS:
        return []
    run = _Run(view, log, feature)
    adapter = ADAPTERS.get(feature)
    if adapter is None:
        # Only an analysis can have findings; a summary batch or a job logs runs too.
        if not is_check(feature):
            return []
        # A check with no adapter yet: one finding that points at the run to read it whole.
        run.add("meaning", "minor", log.description or f"{feature} ran", evidence="Open the run in the Chronicle")
        return run.out
    adapter(run, result_of(log))
    return run.out
