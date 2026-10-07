"""
The queue's lanes, order and stops (doc 21 P2, P5).

Local work used to wait behind a twenty-minute summaries run, Stop on a one-call job only
stopped the browser waiting, pressing a button twice queued the work twice, and nothing
could be moved up, retried or marked as seen. These cover each.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.models.ai_job import AIJob
from app.models.story import Story
from app.services.job_queue import (
    JOB_HANDLERS,
    RUNNING,
    _claim_next,
    enqueue,
    handler,
    interrupt,
    mark_seen,
    prune_quiet,
    request_cancel,
    retry,
    run_job,
    run_next,
)


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


@pytest.fixture(autouse=True)
def fake_handlers():
    original = dict(JOB_HANDLERS)

    @handler("test-model")
    async def _model(job, db, user, report):
        report(1, 1, "Reading chapter 1")
        return {"ok": True}

    @handler("test-local", lane="local", quiet=True)
    async def _local(job, db, user, report):
        return {"ok": True}

    @handler("test-hangs", stop="now")
    async def _hangs(job, db, user, report):
        report(0, 1, "Asking the model")
        await asyncio.sleep(60)
        return {"never": True}

    @handler("test-once", unique=True)
    async def _once(job, db, user, report):
        return {}

    yield
    JOB_HANDLERS.clear()
    JOB_HANDLERS.update(original)


def _job(db, user, story, kind, label="job"):
    return enqueue(db, kind=kind, user_id=user.id, story_id=story.id, label=label)


def test_each_lane_claims_only_its_own(db_session, test_user, story):
    model = _job(db_session, test_user, story, "test-model")
    local = _job(db_session, test_user, story, "test-local")
    assert (model.lane, local.lane, local.quiet) == ("model", "local", True)

    assert _claim_next(db_session, "model").id == model.id
    # The model lane is busy; local work does not wait for it.
    assert _claim_next(db_session, "local").id == local.id
    assert _claim_next(db_session, "model") is None


def test_run_next_moves_a_job_to_the_front(db_session, test_user, story):
    first = _job(db_session, test_user, story, "test-model", "first")
    second = _job(db_session, test_user, story, "test-model", "second")
    run_next(db_session, second)
    assert _claim_next(db_session, "model").id == second.id
    assert _claim_next(db_session, "model").id == first.id


def test_asking_twice_gives_one_job(db_session, test_user, story):
    a = _job(db_session, test_user, story, "test-once")
    b = _job(db_session, test_user, story, "test-once")
    assert a.id == b.id
    a.status = "done"
    db_session.commit()
    assert _job(db_session, test_user, story, "test-once").id != a.id


@pytest.mark.anyio
async def test_stop_now_cancels_the_call_in_hand(db_session, test_user, story):
    job = _job(db_session, test_user, story, "test-hangs")
    claimed = _claim_next(db_session, "model")
    running = asyncio.ensure_future(run_job(claimed, db_session))
    await asyncio.sleep(0.01)
    assert job.id in RUNNING

    request_cancel(db_session, claimed)
    await asyncio.wait_for(running, 2)
    db_session.refresh(job)
    assert job.status == "cancelled" and job.finished_at is not None
    assert job.id not in RUNNING


@pytest.mark.anyio
async def test_making_way_requeues_at_the_front(db_session, test_user, story):
    waiting = _job(db_session, test_user, story, "test-model", "waiting")
    job = _job(db_session, test_user, story, "test-hangs", "interrupted")
    run_next(db_session, job)
    claimed = _claim_next(db_session, "model")
    assert claimed.id == job.id
    running = asyncio.ensure_future(run_job(claimed, db_session))
    await asyncio.sleep(0.01)

    assert interrupt(job.id, "yield")
    await asyncio.wait_for(running, 2)
    db_session.refresh(job)
    assert job.status == "queued" and job.step_label == "Paused for your reply"
    assert job.finished_at is None
    # Back in front of the job that was waiting behind it.
    assert _claim_next(db_session, "model").id == job.id
    assert waiting.status == "queued"


@pytest.mark.anyio
async def test_a_step_label_is_reported_and_cleared(db_session, test_user, story):
    job = _job(db_session, test_user, story, "test-model")
    await run_job(_claim_next(db_session, "model"), db_session)
    db_session.refresh(job)
    assert job.status == "done" and job.step_label is None and (job.progress, job.total) == (1, 1)


def test_a_retry_says_what_it_repeats(db_session, test_user, story):
    job = _job(db_session, test_user, story, "test-model")
    job.status = "error"
    db_session.commit()
    again = retry(db_session, job)
    assert again.id != job.id and again.retry_of == job.id and again.status == "queued"


def test_seen_and_pruned(db_session, test_user, story):
    old = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40)
    quiet = AIJob(kind="test-local", lane="local", quiet=True, user_id=test_user.id, status="done", finished_at=old)
    loud = AIJob(kind="test-model", user_id=test_user.id, status="done", finished_at=old)
    db_session.add_all([quiet, loud])
    db_session.commit()

    assert mark_seen(db_session, test_user.id, [loud.id, quiet.id]) == 2
    assert mark_seen(db_session, test_user.id, [loud.id]) == 0
    assert prune_quiet(db_session) == 1
    assert db_session.get(AIJob, loud.id) is not None


def test_the_api_filters_orders_and_retries(client, db_session, test_user, story):
    first = _job(db_session, test_user, story, "test-model", "first")
    second = _job(db_session, test_user, story, "test-model", "second")
    _job(db_session, test_user, story, "test-local", "local")

    moved = client.post(f"/api/jobs/{second.id}/run-next").json()
    assert moved["queue_position"] == 1 and moved["story_title"] == "Lighthouse"
    listed = {j["label"]: j for j in client.get("/api/jobs?since_hours=24").json()}
    assert listed["first"]["queue_position"] == 2
    assert [j["label"] for j in client.get("/api/jobs?lane=local").json()] == ["local"]

    assert client.post(f"/api/jobs/{first.id}/retry").status_code == 409
    client.post(f"/api/jobs/{first.id}/cancel")
    again = client.post(f"/api/jobs/{first.id}/retry")
    assert again.status_code == 201 and again.json()["retry_of"] == first.id
    assert client.post("/api/jobs/seen", json={"ids": [first.id]}).json() == {"marked": 1}


def test_the_chronicle_filters_running_and_queued(client, db_session, test_user, story):
    _job(db_session, test_user, story, "test-model", "waiting")
    done = _job(db_session, test_user, story, "test-model", "finished")
    done.status = "done"
    db_session.commit()
    entries = client.get(f"/api/chronicle/timeline?story_id={story.id}&running=true").json()["entries"]
    assert [e["job"]["label"] for e in entries] == ["waiting"]
    assert client.get(f"/api/jobs/{done.id}").json()["stop"] == "between"
