"""
Run checks and the Editorial pass as jobs (doc 21 R3).

A check ran inside a request the page held: leaving Findings forgot it was running, and
Stop only stopped the browser waiting. The pass sat behind a modal for five model calls.
These pin the jobs that replace them: one job per check however often it is pressed, the
run logged as before with the job's id, a pass that keeps what it finished when stopped,
and one that resumes rather than starting over.
"""

import anyio

from app.models.activity_log import ActivityLog
from app.models.ai_job import AIJob
from app.services.job_queue import _claim_next, run_job
from tests.fixtures.findings_story import build_findings_story

H = {"X-Client-Id": "tab-doc21"}
ANSWER = {"slow_spots": [], "questions": [], "priorities": [], "gaps": [], "sections": [], "notes": []}


def _run_next(db, lane="model"):
    job = _claim_next(db, lane)
    assert job is not None
    anyio.run(run_job, job, db)
    db.refresh(job)
    return job


def test_a_check_is_one_job_however_often_it_is_asked_for(client, db_session, test_user, mock_ai_gateway):
    story, _nodes = build_findings_story(db_session, test_user)
    mock_ai_gateway(structured_data=ANSWER)
    first = client.post(f"/api/stories/{story.id}/checks/pacing-analysis", headers=H)
    assert first.status_code == 201, first.text
    again = client.post(f"/api/stories/{story.id}/checks/pacing-analysis", headers=H).json()
    assert again["id"] == first.json()["id"] and again["label"] == "Pacing check"
    assert client.post(f"/api/stories/{story.id}/checks/not-a-check", headers=H).status_code == 404

    job = _run_next(db_session)
    assert job.status == "done" and job.result["feature"] == "pacing-analysis"
    run = db_session.get(ActivityLog, job.result["log_id"])
    assert run.event_type == "analysis_run" and run.metadata_["job_id"] == job.id


def test_a_check_that_fails_says_why(client, db_session, test_user, mock_ai_gateway):
    story, _nodes = build_findings_story(db_session, test_user)
    mock_ai_gateway(should_fail=True, error_message="Error reaching LLM: connection refused")
    client.post(f"/api/stories/{story.id}/checks/themes-is-wrong", headers=H)
    client.post(f"/api/stories/{story.id}/checks/theme-tracker", headers=H)
    job = _run_next(db_session)
    assert job.status == "error" and "Error reaching LLM" in job.error


def test_the_pass_runs_as_a_job_and_resumes_where_it_was(client, db_session, test_user, mock_ai_gateway):
    story, _nodes = build_findings_story(db_session, test_user)
    gateway = mock_ai_gateway(structured_data=ANSWER)
    body = {"context_level": "summaries", "scope_type": "story", "scope_ids": []}
    queued = client.post(f"/api/stories/{story.id}/editorial/jobs", json=body, headers=H)
    assert queued.status_code == 201, queued.text
    job = db_session.get(AIJob, queued.json()["id"])
    # Two analyses already done before a pause: only the other three are asked for.
    job.result = {"partial": {"Fresh Eyes": {"questions": []}, "Priorities": {"priorities": []}}}
    db_session.commit()

    job = _run_next(db_session)
    assert job.status == "done", job.error
    assert len(gateway.structured_calls) == 3
    report = db_session.get(ActivityLog, job.result["report_id"])
    assert report.event_type == "editorial_pass" and report.metadata_["job_id"] == job.id
    assert (job.progress, job.total) == (5, 5)


def test_a_stopped_pass_keeps_what_it_finished(client, db_session, test_user, mock_ai_gateway):
    story, _nodes = build_findings_story(db_session, test_user)
    gateway = mock_ai_gateway(structured_data=ANSWER)
    body = {"context_level": "summaries", "scope_type": "story", "scope_ids": []}
    job_id = client.post(f"/api/stories/{story.id}/editorial/jobs", json=body, headers=H).json()["id"]

    asked = gateway.generate_structured

    async def stop_after_two(*args, **kwargs):
        result = await asked(*args, **kwargs)
        if len(gateway.structured_calls) == 2:
            db_session.query(AIJob).filter(AIJob.id == job_id).update({AIJob.cancel_requested: True})
            db_session.commit()
        return result

    gateway.generate_structured = stop_after_two
    job = _run_next(db_session)
    assert job.status == "cancelled" and (job.progress, job.total) == (2, 5)
    report = db_session.get(ActivityLog, job.result["report_id"])
    assert "Stopped after 2 of 5" in report.metadata_["error"]
