"""
Every AI call leaves a record — including the ones that fail (refactor doc 06 §3).

Before this, `_log_call` ran only after a stream completed normally, stored the prompt and
the whole response inside the activity row, and recorded neither the options that were
sent nor the fact that a call errored or was cancelled. So the two calls an author most
wants to inspect — the one that broke and the one they stopped — left no trace at all.
"""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import BaseModel

from app.config import settings
from app.models.activity_log import ActivityLog
from app.models.ai_call import AICallPayload
from app.schemas.ai_responses import StructuredResult
from app.services.ai_call_log import prune_payloads, purge_payloads
from app.services.llm.gateway import AICallContext, ai_gateway
from app.services.llm.ollama import StreamMetrics, ollama_provider


class Shape(BaseModel):
    answer: str


def _ctx(user, feature="scene-chat"):
    return AICallContext(feature=feature, user_id=user.id)


def _logs(db):
    return db.query(ActivityLog).filter(ActivityLog.category == "ai").all()


def _payload(db, log_id):
    return db.query(AICallPayload).filter(AICallPayload.activity_log_id == log_id).one_or_none()


@pytest.fixture(autouse=True)
def no_model_lookup(monkeypatch):
    async def _none(model, base_url=None):
        return None

    monkeypatch.setattr(ollama_provider, "get_context_length", _none)


async def _drain(gen):
    return [chunk async for chunk in gen]


@pytest.mark.anyio
async def test_a_successful_stream_is_recorded_with_its_payload(db_session, test_user, monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield "Hel"
        yield "lo"
        yield StreamMetrics(tokens_in=11, tokens_out=2, model="gemma4")

    monkeypatch.setattr(ollama_provider, "chat_stream_with_metrics", fake_stream)
    out = await _drain(
        ai_gateway.stream(
            messages=[{"role": "user", "content": "hi"}],
            feature_prompt="be useful",
            context=_ctx(test_user),
            db=db_session,
            user=test_user,
        )
    )
    assert "".join(out) == "Hello"

    (log,) = _logs(db_session)
    assert log.metadata_["status"] == "ok"
    assert log.metadata_["num_ctx"] > 0
    payload = _payload(db_session, log.id)
    assert payload.messages == [{"role": "user", "content": "hi"}]
    assert "be useful" in payload.system_prompt
    assert payload.raw_response == "Hello"
    assert payload.options["num_ctx"] == log.metadata_["num_ctx"]
    assert payload.options["temperature"] == settings.ollama_temperature


@pytest.mark.anyio
async def test_a_failed_stream_is_recorded_with_the_error(db_session, test_user, monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield "partial"
        raise RuntimeError("connection reset")

    monkeypatch.setattr(ollama_provider, "chat_stream_with_metrics", fake_stream)
    with pytest.raises(RuntimeError):
        await _drain(
            ai_gateway.stream(
                messages=[{"role": "user", "content": "hi"}],
                feature_prompt="p",
                context=_ctx(test_user),
                db=db_session,
                user=test_user,
            )
        )

    (log,) = _logs(db_session)
    assert log.metadata_["status"] == "error"
    assert "connection reset" in log.metadata_["error"]
    assert _payload(db_session, log.id).raw_response == "partial"


@pytest.mark.anyio
async def test_an_abandoned_stream_is_recorded_as_cancelled(db_session, test_user, monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield "one"
        yield "two"
        yield StreamMetrics(tokens_in=1, tokens_out=2, model="gemma4")

    monkeypatch.setattr(ollama_provider, "chat_stream_with_metrics", fake_stream)
    gen = ai_gateway.stream(
        messages=[{"role": "user", "content": "hi"}],
        feature_prompt="p",
        context=_ctx(test_user),
        db=db_session,
        user=test_user,
    )
    assert await gen.__anext__() == "one"
    await gen.aclose()  # the author hit stop

    (log,) = _logs(db_session)
    assert log.metadata_["status"] == "cancelled"
    assert _payload(db_session, log.id).raw_response == "one"


@pytest.mark.anyio
async def test_thinking_is_kept_apart_from_the_answer(db_session, test_user, monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield "<|channel>thought\nweighing it up<channel|>"
        yield "The answer."
        yield StreamMetrics(tokens_in=1, tokens_out=2, model="gemma4")

    monkeypatch.setattr(ollama_provider, "chat_stream_with_metrics", fake_stream)
    await _drain(
        ai_gateway.stream(
            messages=[{"role": "user", "content": "hi"}],
            feature_prompt="p",
            context=_ctx(test_user),
            db=db_session,
            user=test_user,
        )
    )
    payload = _payload(db_session, _logs(db_session)[0].id)
    assert payload.thinking == "<|channel>thought\nweighing it up<channel|>"
    assert "The answer." in payload.raw_response


@pytest.mark.anyio
async def test_structured_calls_record_the_schema_and_a_fallback(db_session, test_user, monkeypatch):
    async def fake_structured(*args, **kwargs):
        return '{"answer": "yes"}', StreamMetrics(tokens_in=5, tokens_out=3, model="gemma4", schema_fallback=True)

    monkeypatch.setattr(ollama_provider, "generate_structured", fake_structured)
    result = await ai_gateway.generate_structured(
        Shape,
        messages=[{"role": "user", "content": "q"}],
        feature_prompt="p",
        context=_ctx(test_user, "twist-analysis"),
        db=db_session,
        user=test_user,
    )
    assert isinstance(result, StructuredResult) and result.success
    (log,) = _logs(db_session)
    # The provider rejected the schema and answered unconstrained: visible, not silent.
    assert log.metadata_["status"] == "schema-fallback"
    assert _payload(db_session, log.id).response_format["properties"]["answer"]


@pytest.mark.anyio
async def test_a_response_that_is_not_json_is_recorded_as_such(db_session, test_user, monkeypatch):
    async def fake_structured(*args, **kwargs):
        return "sorry, I can't do that", StreamMetrics(tokens_in=5, tokens_out=3, model="gemma4")

    monkeypatch.setattr(ollama_provider, "generate_structured", fake_structured)
    result = await ai_gateway.generate_structured(
        Shape,
        messages=[{"role": "user", "content": "q"}],
        feature_prompt="p",
        context=_ctx(test_user, "twist-analysis"),
        db=db_session,
        user=test_user,
    )
    assert not result.success
    assert _logs(db_session)[0].metadata_["status"] == "invalid-json"


@pytest.mark.anyio
async def test_an_unreachable_model_is_recorded(db_session, test_user, monkeypatch):
    async def boom(*args, **kwargs):
        raise ConnectionError("no route to host")

    monkeypatch.setattr(ollama_provider, "generate_structured", boom)
    result = await ai_gateway.generate_structured(
        Shape,
        messages=[{"role": "user", "content": "q"}],
        feature_prompt="p",
        context=_ctx(test_user, "twist-analysis"),
        db=db_session,
        user=test_user,
    )
    assert not result.success
    (log,) = _logs(db_session)
    assert log.metadata_["status"] == "error"
    assert "no route to host" in log.metadata_["error"]


def test_retention_prunes_payloads_but_keeps_the_record(db_session, test_user):
    log = ActivityLog(user_id=test_user.id, event_type="ai_x", category="ai", description="d", metadata_={})
    db_session.add(log)
    db_session.flush()
    old = AICallPayload(activity_log_id=log.id, created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=91))
    db_session.add(old)
    db_session.commit()

    assert prune_payloads(db_session, 90) == 1
    assert db_session.query(AICallPayload).count() == 0
    assert db_session.query(ActivityLog).count() == 1


def test_retention_can_be_switched_off(db_session, test_user):
    log = ActivityLog(user_id=test_user.id, event_type="ai_x", category="ai", description="d", metadata_={})
    db_session.add(log)
    db_session.flush()
    db_session.add(
        AICallPayload(activity_log_id=log.id, created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=900))
    )
    db_session.commit()
    assert prune_payloads(db_session, 0) == 0
    assert db_session.query(AICallPayload).count() == 1


def test_purge_removes_this_users_payloads(db_session, test_user):
    log = ActivityLog(user_id=test_user.id, event_type="ai_x", category="ai", description="d", metadata_={})
    db_session.add(log)
    db_session.flush()
    db_session.add(AICallPayload(activity_log_id=log.id))
    db_session.commit()
    assert purge_payloads(db_session, test_user.id) == 1
    assert db_session.query(AICallPayload).count() == 0
