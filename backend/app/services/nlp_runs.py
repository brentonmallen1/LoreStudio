"""The two spaCy passes over the manuscript, callable without a request (doc 12 P3).

The analysis endpoints and "Run checks → Local" on the findings feed both run these. Each
logs an ``analysis_run`` with its whole result, which is where the findings feed reads
them back from. No model is involved; the caller commits.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.structure import StructureNode
from ..schemas.nlp_analysis import (
    EditorialConsistencyResponse,
    ProseNLPResponse,
    SceneEditorialAnalysis,
    SceneNLPAnalysis,
)
from .nlp_analysis_service import ALL_CHECKS, analyze_scene, analyze_scene_editorial


def _scenes(story_id: str, db: Session, node_ids: list[str] | None) -> list[StructureNode]:
    q = db.query(StructureNode).filter(StructureNode.story_id == story_id)
    if node_ids:
        q = q.filter(StructureNode.id.in_(node_ids))
    return [n for n in q.all() if n.content and n.content.strip()]


def run_prose_analysis(
    story_id: str, user_id: str, db: Session, node_ids: list[str] | None = None, checks: list[str] | None = None
) -> ProseNLPResponse:
    checks_set = set(checks) & ALL_CHECKS if checks else ALL_CHECKS
    scenes = [
        SceneNLPAnalysis(scene_id=n.id, scene_title=n.title or "", **analyze_scene(n.content, checks_set))
        for n in _scenes(story_id, db, node_ids)
    ]
    result = ProseNLPResponse(scenes=scenes, checks_run=sorted(checks_set))

    warning_count = 0
    for s in scenes:
        for check in checks_set:
            analysis_obj = getattr(s, check, None)
            if analysis_obj and hasattr(analysis_obj, "findings"):
                warning_count += sum(1 for f in (analysis_obj.findings or []) if f.severity in ("warning", "issue"))

    db.add(
        ActivityLog(
            user_id=user_id,
            story_id=story_id,
            event_type="analysis_run",
            category="health",
            description=f"Prose analysis: {len(scenes)} scene(s), {warning_count} warning(s)",
            metadata_={
                "feature": "prose-analysis",
                "result": result.model_dump(),
                "scene_count": len(scenes),
                "warning_count": warning_count,
            },
        )
    )
    return result


def run_editorial_consistency(
    story_id: str, user_id: str, db: Session, node_ids: list[str] | None = None
) -> EditorialConsistencyResponse:
    scenes = [
        SceneEditorialAnalysis(scene_id=n.id, scene_title=n.title or "", **analyze_scene_editorial(n.content))
        for n in _scenes(story_id, db, node_ids)
    ]
    total_tense = sum((s.tense_consistency.shift_count if s.tense_consistency else 0) for s in scenes)
    total_pov = sum(len(s.pov_drift.findings) if s.pov_drift else 0 for s in scenes)
    result = EditorialConsistencyResponse(
        scenes=scenes,
        checks_run=["tense_consistency", "pov_drift"],
        total_tense_shifts=total_tense,
        total_pov_flags=total_pov,
    )
    db.add(
        ActivityLog(
            user_id=user_id,
            story_id=story_id,
            event_type="analysis_run",
            category="health",
            description=(
                f"Editorial consistency: {len(scenes)} scene(s), {total_tense} tense shift(s), {total_pov} POV flag(s)"
            ),
            metadata_={
                "feature": "editorial-consistency",
                "result": result.model_dump(),
                "scene_count": len(scenes),
                "tense_shift_count": total_tense,
                "pov_flag_count": total_pov,
            },
        )
    )
    return result
