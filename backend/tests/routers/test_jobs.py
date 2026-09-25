"""
The AI job queue (refactor doc 06 §8).

Summarising a manuscript held a request open for minutes with nothing to watch and no way
to stop it. These tests cover what a job has to survive: being cancelled, failing, and the
server restarting underneath it.
"""

import pytest

from app.models.ai_job import AIJob
from app.models.story import Story
from app.services.job_queue import (
    JOB_HANDLERS,
    enqueue,
    handler,
    recover_interrupted,
    request_cancel,
    run_job,
)


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


@pytest.fixture(autouse=True)
def fake_handlers():
    """Register throwaway handlers; leave the real registry as it was."""
    original = dict(JOB_HANDLERS)

    @handler("test-counts")
    async def _counts(job, db, user, report):
        for i in range(3):
            if job.cancel_requested:
                return {"stopped_at": i}
            report(i + 1, 3)
        return {"done": 3}

    @handler("test-explodes")
    async def _explodes(job, db, user, report):
        raise RuntimeError("the model was not there")

    @handler("test-breaks-the-session")
    async def _breaks_the_session(job, db, user, report):
        report(1, 2)  # a commit: every attribute on `job` is now expired
        db.add(Story(title="Orphan", user_id="nobody"))
        db.flush()  # a foreign-key failure leaves the session holding a failed flush

    yield
    JOB_HANDLERS.clear()
    JOB_HANDLERS.update(original)


def test_a_job_reports_progress_and_its_result(db_session, test_user, story):
    job = enqueue(db_session, kind="test-counts", user_id=test_user.id, story_id=story.id, label="Counting")
    assert job.status == "queued"

    import anyio

    anyio.run(run_job, job, db_session)
    assert job.status == "done"
    assert job.result == {"done": 3}
    assert (job.progress, job.total) == (3, 3)
    assert job.finished_at is not None


def test_a_failed_job_says_why(db_session, test_user, story):
    job = enqueue(db_session, kind="test-explodes", user_id=test_user.id, story_id=story.id, label="Boom")

    import anyio

    anyio.run(run_job, job, db_session)
    assert job.status == "error"
    assert "the model was not there" in job.error


def test_a_job_that_breaks_the_session_still_ends_as_an_error(db_session, test_user, story):
    """
    The Codex suggestion pass hit a unique constraint mid-job. The failure handler read
    `job.id` before rolling back, which reloaded it through the broken session, raised a
    second error out of run_job, and left the job "running" until the server restarted.
    """
    job = enqueue(db_session, kind="test-breaks-the-session", user_id=test_user.id, story_id=story.id, label="Break")

    import anyio

    anyio.run(run_job, job, db_session)
    assert job.status == "error"
    assert "FOREIGN KEY" in job.error
    assert job.finished_at is not None


def test_cancelling_a_queued_job_stops_it_immediately(db_session, test_user, story):
    job = enqueue(db_session, kind="test-counts", user_id=test_user.id, story_id=story.id, label="Counting")
    assert request_cancel(db_session, job).status == "cancelled"


def test_cancelling_a_running_job_asks_rather_than_kills(db_session, test_user, story):
    """Stopping mid-scene would leave the work half-recorded; the handler stops at a step."""
    job = enqueue(db_session, kind="test-counts", user_id=test_user.id, story_id=story.id, label="Counting")
    job.status = "running"
    db_session.commit()

    request_cancel(db_session, job)
    assert job.status == "running" and job.cancel_requested is True

    import anyio

    anyio.run(run_job, job, db_session)
    assert job.status == "cancelled"
    assert job.result == {"stopped_at": 0}


def test_an_unknown_kind_is_refused_at_enqueue(db_session, test_user):
    with pytest.raises(ValueError):
        enqueue(db_session, kind="not-a-job", user_id=test_user.id, label="?")


def test_a_job_interrupted_by_a_restart_says_so(db_session, test_user, story):
    job = enqueue(db_session, kind="test-counts", user_id=test_user.id, story_id=story.id, label="Counting")
    job.status = "running"
    db_session.commit()

    assert recover_interrupted(db_session) == 1
    db_session.refresh(job)
    assert job.status == "error" and "restart" in job.error.lower()


def test_the_api_lists_queues_and_cancels(client, db_session, test_user, story):
    created = client.post(f"/api/stories/{story.id}/jobs/scene-summaries", json={"force_refresh": True})
    assert created.status_code == 201, created.text
    job_id = created.json()["id"]
    assert created.json()["label"].startswith("Scene summaries")

    listed = client.get(f"/api/jobs?story_id={story.id}").json()
    assert [j["id"] for j in listed] == [job_id]
    assert client.get("/api/jobs?active_only=true").json()[0]["id"] == job_id

    cancelled = client.post(f"/api/jobs/{job_id}/cancel").json()
    assert cancelled["status"] == "cancelled"


def test_jobs_belong_to_their_owner(client, db_session, test_user, story):
    from app.auth.utils import hash_password
    from app.models.user import User

    stranger = User(
        id="stranger",
        username="stranger",
        password_hash=hash_password("x"),
        display_name="Stranger",
        settings={},
    )
    db_session.add(stranger)
    db_session.flush()
    other = AIJob(user_id=stranger.id, kind="scene-summaries", label="Not yours")
    db_session.add(other)
    db_session.commit()
    assert client.get(f"/api/jobs/{other.id}").status_code == 404
    assert client.post(f"/api/jobs/{other.id}/cancel").status_code == 404
