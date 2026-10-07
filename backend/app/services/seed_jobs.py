"""
Jobs in "The Last Lighthouse" (doc 21): what the header's Jobs list is for, on a new install.

Two runs the author started and left: a Pacing check that finished while they were away (so
the header has its dot, and Jobs opens on "While you were away"), and last night's Editorial
pass, stopped after two of its five analyses, its report keeping what it finished. Each is
what a real run leaves: the job, its calls in the Chronicle, and the run the findings read.
"""

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.story import Story
from ..models.user import User
from ..schemas.editorial import (
    EditorialReportMetadata,
    EditorialStats,
    FreshEyesQuestion,
    FreshEyesResponse,
    PrioritiesResponse,
    RevisionPriority,
)
from .seed_chronicle import _call

PACING = {
    "act_balance": {"summary": "The first act carries most of the written words; the third is still planned."},
    "tension_curve": {
        "summary": "Tension rises cleanly from the barometer to the knock, dips in the watch room, "
        "and climbs again from the missing months."
    },
    "slow_spots": ["The Logbook"],
    "pacing_strengths": ["The Gap turns on one physical detail, the volume's wrong weight, and moves fast from it."],
    "recommendations": [
        "Let The Logbook reach the cabinet sooner: the volumes' history could arrive while Eleanor "
        "hesitates rather than before she does."
    ],
    "overall_rating": "good",
}

FRESH_EYES = FreshEyesResponse(
    questions=[
        FreshEyesQuestion(
            section_title="Knock at the Door",
            question="Eleanor has decided not to open the door, and opens it anyway. What tips her?",
            context="The decision and the opening are a line apart.",
            anchor="Eleanor stepped back. Later she would wonder why.",
        ),
        FreshEyesQuestion(
            section_title="The Gap",
            question="She knows the volumes by heft. Has she never lifted the one for five years ago before tonight?",
            context="The wrong weight tells her at once.",
            anchor="She had carried these volumes a hundred times. She knew them by heft.",
        ),
    ],
    summary="A reader follows this closely; the questions are about why Eleanor acts, not what happens.",
)

PRIORITIES = PrioritiesResponse(
    priorities=[
        RevisionPriority(
            rank=1,
            section_title="The Gap",
            issue="The missing months are found in a paragraph and then left behind",
            suggestion="Give Eleanor a beat after the jump to March: what her hands do, what she does not say to the Visitor.",
            impact="high",
            anchor="Then the pages jumped to March. Six months, gone.",
        ),
        RevisionPriority(
            rank=2,
            section_title="Knock at the Door",
            issue="Eleanor's reason for letting the Visitor in is not on the page",
            suggestion="One concrete thing about the woman on the step that makes refusing impossible.",
            impact="medium",
            anchor="At the time it felt like the only sensible thing to do.",
        ),
    ],
    overall_note="Two places where Eleanor's choices are told rather than earned.",
)


def _pacing_check(db: Session, user: User, story: Story, now: datetime) -> None:
    start = now - timedelta(minutes=40)
    job = AIJob(
        user_id=user.id,
        story_id=story.id,
        kind="check",
        label="Pacing check",
        status="done",
        params={"feature": "pacing-analysis"},
        progress=1,
        total=1,
        created_at=start,
        started_at=start,
        finished_at=start + timedelta(seconds=48),
    )
    db.add(job)
    db.flush()
    answer = json.dumps(PACING)
    _call(
        db,
        user=user,
        story=story,
        job=job,
        at=start + timedelta(seconds=1),
        feature="pacing-analysis",
        system_prompt="(The pacing prompt, built from the scene list.)",
        user_message="Analyze this story's pacing.",
        response=answer,
        tokens=(1840, 212),
        latency_ms=46800,
    )
    run = ActivityLog(
        user_id=user.id,
        story_id=story.id,
        event_type="analysis_run",
        category="health",
        description="Pacing analysis: 1 slow spot(s) identified",
        created_at=start + timedelta(seconds=48),
        metadata_={
            "feature": "pacing-analysis",
            "result": {"success": True, "data": PACING, "model": "gemma4"},
            "issue_count": 1,
            "job_id": job.id,
        },
    )
    db.add(run)
    db.flush()
    job.result = {"feature": "pacing-analysis", "log_id": run.id, "summary": run.description}


def _stopped_pass(db: Session, user: User, story: Story, now: datetime) -> None:
    start = now - timedelta(hours=14)
    job = AIJob(
        user_id=user.id,
        story_id=story.id,
        kind="editorial-pass",
        label="Editorial pass, whole story",
        status="cancelled",
        params={"context_level": "summaries", "scope_type": "story", "scope_ids": []},
        progress=2,
        total=5,
        cancel_requested=True,
        created_at=start,
        started_at=start,
        finished_at=start + timedelta(minutes=3),
        seen_at=start + timedelta(minutes=3),
    )
    db.add(job)
    db.flush()
    for i, (name, part) in enumerate((("Fresh Eyes", FRESH_EYES), ("Priorities", PRIORITIES))):
        _call(
            db,
            user=user,
            story=story,
            job=job,
            at=start + timedelta(seconds=5 + 80 * i),
            feature="editorial-pass",
            system_prompt=f"(The {name} prompt, built from the scene summaries.)",
            user_message="Perform the editorial analysis.",
            response=part.model_dump_json(),
            tokens=(2400, 260),
            latency_ms=74000,
        )
    error = "Stopped after 2 of 5 analyses."
    report = ActivityLog(
        user_id=user.id,
        story_id=story.id,
        event_type="editorial_pass",
        category="health",
        description="Editorial pass: whole story (summaries context)",
        created_at=start + timedelta(minutes=3),
        metadata_={
            **EditorialReportMetadata(
                context_level="summaries",
                scope_type="story",
                stats=EditorialStats(fresh_eyes_count=2, priorities_count=2),
                fresh_eyes=FRESH_EYES,
                priorities=PRIORITIES,
                error=error,
            ).model_dump(),
            "job_id": job.id,
        },
    )
    db.add(report)
    db.flush()
    job.result = {"report_id": report.id, "summary": report.description, "error": error}


def seed_lighthouse_jobs(db: Session, *, user: User, story: Story) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    _stopped_pass(db, user, story, now)
    _pacing_check(db, user, story, now)
    db.flush()
