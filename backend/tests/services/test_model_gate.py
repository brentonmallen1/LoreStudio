"""
Replies first: the model gate (doc 21 P3, D10).

One local model answers one call at a time. A reply that comes while a job's call is running
stops that call and sends the job back to the front of its lane; nothing new starts until a
cool-down after the last reply, unless the author says Start now; and a model that is not
answering pauses the lane instead of failing every job in turn.
"""

import asyncio

import pytest

from app.models.story import Story
from app.services.job_queue import JOB_HANDLERS, _claim_next, _model_may_start, enqueue, handler, run_job
from app.services.llm.gate import model_gate
from app.services.llm.gateway import AIDisabledError


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


@pytest.fixture(autouse=True)
def fake_handlers():
    original = dict(JOB_HANDLERS)

    @handler("test-asks")
    async def _asks(job, db, user, report):
        async with model_gate.job(job.id):
            await asyncio.sleep(60)
        return {}

    @handler("test-unreachable")
    async def _unreachable(job, db, user, report):
        raise RuntimeError("Error reaching LLM: [Errno 61] Connection refused")

    @handler("test-switched-off")
    async def _off(job, db, user, report):
        raise AIDisabledError("AI is switched off in Settings › AI.")

    yield
    JOB_HANDLERS.clear()
    JOB_HANDLERS.update(original)


def _queue(db, user, story, kind="test-asks"):
    return enqueue(db, kind=kind, user_id=user.id, story_id=story.id, label=kind)


@pytest.mark.anyio
async def test_a_reply_stops_the_job_and_sends_it_back_to_the_front(db_session, test_user, story):
    behind = _queue(db_session, test_user, story)
    job = _queue(db_session, test_user, story)
    db_session.query(type(job)).filter_by(id=job.id).update({"position": behind.position - 1})
    db_session.commit()
    claimed = _claim_next(db_session)
    assert claimed.id == job.id
    running = asyncio.ensure_future(run_job(claimed, db_session))
    await asyncio.sleep(0.05)

    async with model_gate.live(cooldown=0):
        await asyncio.wait_for(running, 2)

    db_session.refresh(job)
    assert job.status == "queued" and job.step_label == "Paused for your reply"
    assert _claim_next(db_session).id == job.id  # still ahead of the one behind it


@pytest.mark.anyio
async def test_nothing_starts_during_the_cool_down_unless_started_now(db_session, test_user, story):
    job = _queue(db_session, test_user, story)
    async with model_gate.live(cooldown=60):
        assert model_gate.waiting_reason() == "Waiting: a reply goes first"
        assert not _model_may_start(db_session)
    assert "after your last reply" in model_gate.waiting_reason()
    assert not _model_may_start(db_session)

    model_gate.start_now(job.id)
    assert _model_may_start(db_session)
    model_gate.finished(job.id)
    assert not _model_may_start(db_session)


@pytest.mark.anyio
async def test_a_job_call_waits_while_a_reply_runs(db_session, test_user, story):
    order: list[str] = []

    async def job_call():
        async with model_gate.job("j1"):
            order.append("job")

    async with model_gate.live(cooldown=0):
        waiting = asyncio.ensure_future(job_call())
        await asyncio.sleep(0.4)
        order.append("reply")
    await asyncio.wait_for(waiting, 2)
    assert order == ["reply", "job"]


@pytest.mark.anyio
async def test_a_model_that_is_not_there_pauses_the_lane(db_session, test_user, story):
    job = _queue(db_session, test_user, story, "test-unreachable")
    await run_job(_claim_next(db_session), db_session)
    db_session.refresh(job)
    assert job.status == "queued" and job.step_label == "Paused: the model is not answering."
    assert model_gate.waiting_reason().startswith("Paused: the model is not answering. Trying again in")
    assert not _model_may_start(db_session)
    model_gate.start_now(job.id)  # Try now
    assert _model_may_start(db_session)


@pytest.mark.anyio
async def test_switched_off_holds_the_jobs(db_session, test_user, story):
    job = _queue(db_session, test_user, story, "test-switched-off")
    await run_job(_claim_next(db_session), db_session)
    db_session.refresh(job)
    assert job.status == "queued" and job.step_label.startswith("Held: the Assistant is switched off")


def test_the_list_says_why_the_next_job_waits(client, db_session, test_user, story):
    first = _queue(db_session, test_user, story)
    _queue(db_session, test_user, story)
    model_gate.pause("Paused: the model is not answering.")
    listed = {j["id"]: j for j in client.get("/api/jobs?since_hours=1").json()}
    assert listed[first.id]["waiting"].startswith("Paused") and listed[first.id]["can_start_now"]
    assert [j["waiting"] for j in listed.values() if j["id"] != first.id] == [None]

    started = client.post(f"/api/jobs/{first.id}/start-now").json()
    assert started["waiting"] is None and not started["can_start_now"]


def test_the_cool_down_is_a_setting(client, test_user):
    assert client.get("/api/ai-settings").json()["jobs_cooldown_seconds"] == 60
    out = client.patch("/api/ai-settings", json={"jobs_cooldown_seconds": 15}).json()
    assert out["jobs_cooldown_seconds"] == 15 and model_gate.cooldown == 15
    assert client.patch("/api/ai-settings", json={"jobs_cooldown_seconds": -1}).status_code == 422


@pytest.mark.anyio
async def test_a_model_that_answers_several_at_once_needs_no_turns(db_session, test_user, story):
    """Settings › AI says the model serves several calls at once: a reply stops no job, starts
    no cool-down, and a job does not wait for it. A pause still holds the lane."""
    job = _queue(db_session, test_user, story)
    running = asyncio.ensure_future(run_job(_claim_next(db_session), db_session))
    await asyncio.sleep(0.05)

    async with model_gate.live(cooldown=60, exclusive=False):
        await asyncio.sleep(0.1)
        assert not running.done()  # the job's call was not stopped
        assert model_gate.waiting_reason(exclusive=False) is None
        assert not model_gate.replying()
    assert model_gate.cooldown_left() == 0  # no cool-down after it
    running.cancel()

    model_gate.pause("Paused: the model is not answering.")
    assert not model_gate.may_start(job.id, exclusive=False)


def test_the_setting_reaches_the_jobs_list(client, db_session, test_user, story):
    first = _queue(db_session, test_user, story)
    model_gate._last_live_end = __import__("time").monotonic()  # a reply just ended
    listed = {j["id"]: j for j in client.get("/api/jobs?since_hours=1").json()}
    assert listed[first.id]["waiting"].startswith("Waiting: starts")

    assert client.patch("/api/ai-settings", json={"model_parallel": True}).json()["model_parallel"] is True
    listed = {j["id"]: j for j in client.get("/api/jobs?since_hours=1").json()}
    assert listed[first.id]["waiting"] is None
