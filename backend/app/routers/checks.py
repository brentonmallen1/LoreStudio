"""
Run checks as jobs (doc 21 R3).

The nine Assistant checks on Findings each ran inside a request the page held: leaving the
page forgot the check was running, and Stop only stopped the browser waiting while the model
went on and the run landed anyway. Now Run checks queues a `check` job. It runs on the model
lane, carries on while the author writes, stops at once when asked (it writes its result
only after its one call returns), and appears in the header's Jobs list.

The job calls the analysis itself, so the run is logged exactly as before (one
`analysis_run` row, which the findings feed reads) and gains the job's id.
"""

from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.story import Story
from ..models.user import User
from ..schemas.ai_responses import StructuredResult
from ..schemas.jobs import JobOut
from ..services.job_queue import enqueue, handler
from . import analysis

router = APIRouter()

CheckFn = Callable[..., Awaitable[StructuredResult]]

#: The checks Run checks offers, by feature id: what the job calls, and its name in the list.
CHECKS: dict[str, tuple[CheckFn, str]] = {
    "pacing-analysis": (analysis.analyze_pacing, "Pacing"),
    "plot-holes": (analysis.analyze_plot_holes, "Plot holes"),
    "continuity-check": (analysis.analyze_continuity, "Continuity"),
    "character-dimensionality": (analysis.analyze_all_character_dimensionality, "Character depth"),
    "theme-tracker": (analysis.analyze_themes, "Themes"),
    "cliche-analysis": (analysis.analyze_cliches, "Clichés"),
    "first-pass": (analysis.analyze_first_pass, "First-pass editor"),
    "essential-questions": (analysis.analyze_essential_questions, "Story compass"),
    "economy-analysis": (analysis.analyze_economy, "Story economy"),
}


@handler("check", stop="now", unique=True)
async def _run_check(job: AIJob, db: Session, user: User, report) -> dict:
    feature = job.params.get("feature", "")
    if feature not in CHECKS:
        raise RuntimeError(f"There is no check called {feature!r}.")
    fn, _name = CHECKS[feature]
    report(0, 1, "Asking the model")
    kwargs = {"character_id": None} if feature == "essential-questions" else {}
    try:
        result = await fn(job.story_id, db=db, current_user=user, **kwargs)
    except HTTPException as exc:  # "No characters found": the author's words, not a traceback
        raise RuntimeError(str(exc.detail)) from exc
    report(1, 1)
    if not result.success:
        raise RuntimeError((result.raw_text or "The model's answer could not be read.").split("\n")[0])
    run = (
        db.query(ActivityLog)
        .filter(ActivityLog.story_id == job.story_id, ActivityLog.event_type == "analysis_run")
        .order_by(ActivityLog.created_at.desc())
        .first()
    )
    return {"feature": feature, "log_id": run.id if run else None, "summary": run.description if run else ""}


@router.post("/stories/{story_id}/checks/{feature}", response_model=JobOut, status_code=201)
def queue_check(story_id: str, feature: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Queue one Assistant check. Asking again while it is queued or running returns that job."""
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if feature not in CHECKS:
        raise HTTPException(status_code=404, detail="No such check")
    name = CHECKS[feature][1]
    return enqueue(
        db,
        kind="check",
        user_id=user.id,
        story_id=story_id,
        label=f"{name} check",
        params={"feature": feature},
    )
