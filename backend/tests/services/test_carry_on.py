"""
A stream whose result is kept runs to the end when its reader leaves (doc 21 R7, D16).

Closing the window used to cancel the call: a scene summary half-written was thrown away and
an interview reply was never saved. Now only Stop ends it early.
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.services.llm.gateway import AICallContext
from app.services.llm.sse import CARRYING, sse_stream


class SlowGateway:
    """Streams a few tokens, slowly, and saves the answer at the end as a feature would."""

    def __init__(self):
        self.saved: list[str] = []

    async def stream(self, *, on_complete=None, on_result=None, **_kw):
        out = []
        for word in ("The ", "lamp ", "is ", "lit."):
            await asyncio.sleep(0.02)
            out.append(word)
            yield word
        if on_complete:
            await on_complete(SimpleNamespace(content="".join(out)))


def _response(gateway, *, feature="scene-summary", keep=True):
    async def on_complete(result):
        gateway.saved.append(result.content)

    return sse_stream(
        gateway,
        messages=[],
        feature_prompt="",
        context=AICallContext(feature=feature, user_id="u1"),
        db=None,
        user=SimpleNamespace(id="u1"),
        on_complete=on_complete if keep else None,
    )


@pytest.mark.anyio
async def test_the_reader_leaving_does_not_stop_a_kept_stream():
    gateway = SlowGateway()
    response = _response(gateway)
    assert response.headers["X-Stream-Id"]
    body = response.body_iterator
    first = await body.__anext__()
    assert "The" in first
    await body.aclose()  # the window closed
    assert gateway.saved == ["The lamp is lit."]
    assert not CARRYING


@pytest.mark.anyio
async def test_stop_ends_it_early():
    gateway = SlowGateway()
    response = _response(gateway)
    body = response.body_iterator
    await body.__anext__()
    task, owner = CARRYING[response.headers["X-Stream-Id"]]
    assert owner == "u1"
    task.cancel()
    rest = [frame async for frame in body]
    assert gateway.saved == [] and len(rest) <= 3


@pytest.mark.anyio
async def test_a_stream_nobody_keeps_is_not_carried():
    response = _response(SlowGateway(), feature="scene-chat", keep=False)
    assert "X-Stream-Id" not in response.headers


def test_stop_belongs_to_whoever_started_it(client):
    assert client.post("/api/streams/nope/stop").json() == {"stopped": False}
