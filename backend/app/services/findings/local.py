"""Local checks: deterministic, no model (doc 12 P3).

Name drift and unknown speakers are cheap and run on every read. The spaCy checks (prose
habits, tense, point of view) are too slow for that; "Run checks → Local" runs them and
logs the result like any analysis, and their findings are read from the latest run,
minus any whose passage the author has since rewritten.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ...models.activity_log import ActivityLog
from ...schemas.findings import Finding, FindingAnchor, FindingFix
from ..consistency import name_drift, unknown_speakers
from .make import make
from .runs import result_of
from .view import StoryView

#: Local runs: the features "Run checks → Local" writes, read back here.
LOCAL_FEATURES = ("prose-analysis", "editorial-consistency")

#: Check → (one, many). The count is of flagged passages still in the scene.
_HABITS = {
    "passive_voice": ("Passive voice in 1 sentence", "Passive voice in {n} sentences"),
    "adverb_overuse": ("Leans on an adverb", "Leans on adverbs: {n} flagged"),
    "said_bookisms": ("A dialogue tag other than said", "{n} dialogue tags other than said"),
    "repeated_words": ("A word repeated close together", "{n} words repeated close together"),
}


def computed(view: StoryView, db: Session) -> list[Finding]:
    out: list[Finding] = []
    for f in name_drift(view.written, view.characters):
        out.append(
            make(
                "name_drift",
                "continuity",
                "mid",
                "local",
                f"“{f.text}” is close to {f.suggestion}: a slip, or someone new?",
                anchor=FindingAnchor(node_id=f.node_id),
                key=f.text,
                evidence=f.excerpt,
                where=f.node_title or "Untitled scene",
                action="fix",
                fix=FindingFix(old=f.text, new=f.suggestion),
            )
        )
    for f in unknown_speakers(view.written, view.characters, db):
        out.append(
            make(
                "unknown_speaker",
                "cast",
                "low",
                "local",
                f"“{f.text}” speaks here but is not in the Lorebook",
                anchor=FindingAnchor(node_id=f.node_id),
                key=f.text,
                evidence=f.excerpt,
                suggestion=f.suggestion,
                where=f.node_title or "Untitled scene",
            )
        )
    return out


def _run_fields(log: ActivityLog, node) -> dict:
    return {
        "where": node.title or "Untitled scene",
        "run_id": log.id,
        "feature": (log.metadata_ or {}).get("feature"),
        "created_at": log.created_at,
    }


def from_prose_run(view: StoryView, log: ActivityLog) -> list[Finding]:
    out: list[Finding] = []
    for scene in result_of(log).get("scenes", []):
        node = view.by_id.get(scene.get("scene_id", ""))
        if node is None:
            continue
        for check, (one, many) in _HABITS.items():
            flagged = [
                f
                for f in (scene.get(check) or {}).get("findings", [])
                if f.get("severity") in ("warning", "issue") and view.still_there(node, f.get("passage", ""))
            ]
            if not flagged:
                continue
            out.append(
                make(
                    check,
                    "prose",
                    "mid" if any(f.get("severity") == "issue" for f in flagged) else "low",
                    "local",
                    one if len(flagged) == 1 else many.format(n=len(flagged)),
                    anchor=FindingAnchor(node_id=node.id),
                    key=check,
                    evidence=flagged[0].get("passage", ""),
                    suggestion=flagged[0].get("suggestion") or flagged[0].get("explanation", ""),
                    **_run_fields(log, node),
                )
            )
        variety = scene.get("sentence_variety") or {}
        if variety.get("assessment") == "monotonous":
            out.append(
                make(
                    "sentence_variety",
                    "prose",
                    "low",
                    "local",
                    "Sentences run to one length",
                    anchor=FindingAnchor(node_id=node.id),
                    key="sentence_variety",
                    evidence=f"About {round(variety.get('mean_length') or 0)} words each",
                    **_run_fields(log, node),
                )
            )
    return out


def from_editorial_run(view: StoryView, log: ActivityLog) -> list[Finding]:
    out: list[Finding] = []
    for scene in result_of(log).get("scenes", []):
        node = view.by_id.get(scene.get("scene_id", ""))
        if node is None:
            continue
        tense = scene.get("tense_consistency") or {}
        shifts = [f for f in tense.get("findings", []) if view.still_there(node, f.get("sentence", ""))]
        if shifts:
            dominant = tense.get("dominant_tense") or "the scene's tense"
            out.append(
                make(
                    "tense_shift",
                    "prose",
                    "mid",
                    "local",
                    f"Slips out of {dominant} tense " + ("once" if len(shifts) == 1 else f"{len(shifts)} times"),
                    anchor=FindingAnchor(node_id=node.id),
                    key="tense_shift",
                    evidence=shifts[0].get("sentence", ""),
                    **_run_fields(log, node),
                )
            )
        pov = scene.get("pov_drift") or {}
        drifts = [f for f in pov.get("findings", []) if view.still_there(node, f.get("sentence", ""))]
        if drifts:
            # spaCy's subjects include "people" and "everyone"; only a character is a POV.
            names = {part.lower() for c in view.characters for part in (c.name or "").split()}
            subjects = sorted({s for f in drifts for s in f.get("subjects", []) if s.lower() in names})
            whose = f" into {', '.join(subjects)}'s head" if subjects else ""
            out.append(
                make(
                    "pov_drift",
                    "prose",
                    "mid",
                    "local",
                    f"Point of view slips{whose}",
                    anchor=FindingAnchor(node_id=node.id),
                    key="pov_drift",
                    evidence=drifts[0].get("sentence", ""),
                    suggestion=drifts[0].get("explanation", ""),
                    **_run_fields(log, node),
                )
            )
    return out
