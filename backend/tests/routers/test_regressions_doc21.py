"""Regression tests for the defects doc 21 found while mapping jobs (notes/refactor-2026-09/21-*).

A structured call stopped mid-flight left no record, and Writer mode's Chronicle hid every
job, the author's own local measurements included; both tests failed before their fixes. The
claim is now one conditional UPDATE; its race needs two workers, so its test pins the contract.
"""

import asyncio

import pytest
from pydantic import BaseModel

from app.models.activity_log import ActivityLog
from app.models.ai_job import AIJob
from app.models.story import Story
from app.services.job_queue import _claim_next
from app.services.llm.gateway import AICallContext, ai_gateway
from app.services.llm.ollama import ollama_provider


class Shape(BaseModel):
    answer: str


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


@pytest.mark.anyio
async def test_a_stopped_structured_call_is_recorded(db_session, test_user, monkeypatch):
    async def _none(model, base_url=None):
        return None

    async def _hangs(*args, **kwargs):
        await asyncio.sleep(60)

    monkeypatch.setattr(ollama_provider, "get_context_length", _none)
    monkeypatch.setattr(ollama_provider, "generate_structured", _hangs)
    call = asyncio.ensure_future(
        ai_gateway.generate_structured(
            Shape,
            [{"role": "user", "content": "pace it"}],
            "p",
            AICallContext(feature="pacing-analysis", user_id=test_user.id),
            db_session,
            test_user,
        )
    )
    await asyncio.sleep(0.01)
    call.cancel()
    with pytest.raises(asyncio.CancelledError):
        await call

    (log,) = db_session.query(ActivityLog).filter(ActivityLog.category == "ai").all()
    assert log.metadata_["status"] == "cancelled"


def test_the_worker_never_claims_a_cancelled_job(db_session, test_user, story):
    first = AIJob(kind="codex-sync", user_id=test_user.id, story_id=story.id, label="first", status="cancelled")
    second = AIJob(kind="codex-sync", user_id=test_user.id, story_id=story.id, label="second")
    db_session.add_all([first, second])
    db_session.commit()

    claimed = _claim_next(db_session)
    assert claimed is not None and claimed.label == "second"
    assert claimed.status == "running" and claimed.started_at is not None
    assert _claim_next(db_session) is None


def test_writer_mode_chronicle_lists_local_jobs(client, db_session, test_user, story):
    db_session.add_all(
        [
            AIJob(kind="numbers-backfill", user_id=test_user.id, story_id=story.id, label="Measuring", status="done"),
            AIJob(kind="scene-summaries", user_id=test_user.id, story_id=story.id, label="Summaries", status="done"),
        ]
    )
    db_session.commit()
    entries = client.get(f"/api/chronicle/timeline?story_id={story.id}&exclude_ai=true").json()["entries"]
    assert [e["job"]["label"] for e in entries if e.get("job")] == ["Measuring"]
