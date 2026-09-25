"""
Typed server-sent events for LLM streams.

The wire format used to be raw `text/plain`, which meant two things travelled inside the
prose that were never prose. Failures, appended as text once the transport had already
committed to `200 OK`, so the client could not tell "the model said this" from "the server
broke". And Gemma's reasoning, delimited by sentinels that four different React components
each regexed back out.

Both now have an event of their own, so the view layer receives text that is text.

    event: thinking   {"delta": "..."}
    event: token      {"delta": "..."}
    event: usage      {"prompt_tokens": 1204, "eval_tokens": 380, "model": "..."}
    event: error      {"message": "...", "where": "..."}
    event: done       {}

Consumers ignore events they do not know, so a new one is additive.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from typing import TYPE_CHECKING, Any

from fastapi.responses import StreamingResponse

from .ollama import THOUGHT_CLOSE, THOUGHT_OPEN

if TYPE_CHECKING:  # pragma: no cover - import cycle: the gateway is resolved at call time
    from sqlalchemy.orm import Session

    from ...models.user import User
    from .gateway import AICallContext

logger = logging.getLogger(__name__)

SSE_MEDIA_TYPE = "text/event-stream"

#: Without these a proxy may sit on the response and deliver it in one lump, which for a
#: token stream is indistinguishable from the model being slow.
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def format_event(event: str, data: dict[str, Any] | None = None) -> str:
    """
    Frame one event. JSON escapes newlines, so the payload can never break the `data:`
    line and split one event into two.
    """
    return f"event: {event}\ndata: {json.dumps(data or {}, ensure_ascii=False)}\n\n"


def _held_back(buf: str, sentinel: str) -> int:
    """How many trailing characters could still turn into `sentinel` given more input."""
    for size in range(min(len(buf), len(sentinel) - 1), 0, -1):
        if sentinel.startswith(buf[-size:]):
            return size
    return 0


class ThoughtSplitter:
    """
    Separates reasoning from prose as it arrives.

    A sentinel can straddle a chunk boundary — `<|chan` in one chunk, `nel>thought\\n` in
    the next — so a tail that could still become one is held back rather than emitted as
    prose. That is why this cannot be a regex over finished text, and why every consumer
    that tried to do it with one had a window where half a sentinel was rendered.
    """

    def __init__(self) -> None:
        self._buf = ""
        self._thinking = False

    def feed(self, chunk: str) -> list[tuple[str, str]]:
        """Return `(kind, text)` pairs ready to send, where kind is `token` or `thinking`."""
        self._buf += chunk
        out: list[tuple[str, str]] = []
        while True:
            sentinel = THOUGHT_CLOSE if self._thinking else THOUGHT_OPEN
            kind = "thinking" if self._thinking else "token"
            at = self._buf.find(sentinel)
            if at == -1:
                cut = len(self._buf) - _held_back(self._buf, sentinel)
                ready, self._buf = self._buf[:cut], self._buf[cut:]
                if ready:
                    out.append((kind, ready))
                return out
            if at:
                out.append((kind, self._buf[:at]))
            self._buf = self._buf[at + len(sentinel) :]
            self._thinking = not self._thinking

    def flush(self) -> list[tuple[str, str]]:
        """The model stopped mid-block. Emit what is held rather than swallowing it."""
        rest, self._buf = self._buf, ""
        return [("thinking" if self._thinking else "token", rest)] if rest else []


def _message_for(exc: BaseException) -> str:
    """
    What the author is told. The exception itself goes to the log: a stack trace or a
    connection string is not something to render into someone's manuscript.
    """
    if isinstance(exc, OSError):
        return "The model could not be reached. Check that Ollama is running."
    return "Something went wrong while generating this."


class UsageProbe:
    """
    Catches the call result on its way past so `usage` can be emitted before `done`.

    Passed to `ai_gateway.stream(on_result=...)`, which calls it synchronously from the
    same `finally` that writes the Chronicle entry.
    """

    def __init__(self) -> None:
        self.result: Any = None

    def __call__(self, result: Any) -> None:
        self.result = result

    def usage(self) -> dict[str, Any] | None:
        if self.result is None:
            return None
        return {
            "prompt_tokens": self.result.tokens_in,
            "eval_tokens": self.result.tokens_out,
            "model": self.result.model,
        }


async def sse_events(
    tokens: AsyncIterator[str],
    *,
    where: str,
    usage: UsageProbe | None = None,
    on_text: Callable[[str], None] | None = None,
) -> AsyncIterator[str]:
    """
    Wrap a token stream in the typed envelope.

    `on_text` receives the finished prose with reasoning already removed, which is what a
    router should persist — the Chronicle used to store the thought blocks too, and every
    reader of that column had to strip them again.
    """
    splitter = ThoughtSplitter()
    prose: list[str] = []
    error: str | None = None

    try:
        try:
            async for chunk in tokens:
                for kind, text in splitter.feed(chunk):
                    if kind == "token":
                        prose.append(text)
                    yield format_event(kind, {"delta": text})
            for kind, text in splitter.flush():
                if kind == "token":
                    prose.append(text)
                yield format_event(kind, {"delta": text})
        except (asyncio.CancelledError, GeneratorExit):
            raise
        except Exception as exc:
            logger.exception("Streaming failure in %s", where, exc_info=exc)
            error = _message_for(exc)
    finally:
        # Half an answer is still an answer, and the author asked for it. Sync only: an
        # async generator may not await while unwinding a disconnect (see CHAT_REVIEW 2.2).
        if on_text:
            try:
                on_text("".join(prose))
            except Exception:
                logger.exception("Persisting the answer failed in %s", where)

    if error:
        yield format_event("error", {"message": error, "where": where})
    elif usage and (numbers := usage.usage()):
        yield format_event("usage", numbers)
    yield format_event("done")


async def split_events(
    tokens: AsyncIterator[str],
    *,
    extra: dict[str, Any] | None = None,
    prose: list[str] | None = None,
) -> AsyncIterator[str]:
    """
    Emit one speaker's tokens as `token` and `thinking` events, appending the prose to
    `prose` if given. For streams that carry more than one voice and so cannot use
    `sse_events`, which owns the whole response.
    """
    splitter = ThoughtSplitter()

    def frames(pairs: list[tuple[str, str]]) -> list[str]:
        out = []
        for kind, text in pairs:
            if kind == "token" and prose is not None:
                prose.append(text)
            out.append(format_event(kind, {**(extra or {}), "delta": text}))
        return out

    async for token in tokens:
        for frame in frames(splitter.feed(token)):
            yield frame
    for frame in frames(splitter.flush()):
        yield frame


async def sse_text(message: str) -> AsyncIterator[str]:
    """A complete answer with no model behind it, in the envelope, so clients have one path."""
    yield format_event("token", {"delta": message})
    yield format_event("done")


def sse_response(events: AsyncIterator[str], *, headers: dict[str, str] | None = None) -> StreamingResponse:
    return StreamingResponse(
        events,
        media_type=SSE_MEDIA_TYPE,
        headers={**SSE_HEADERS, **(headers or {})},
    )


def sse_message(text: str) -> StreamingResponse:
    """A complete answer with no model behind it, in the envelope, so clients have one path."""
    return sse_response(sse_text(text))


def sse_stream(
    gateway: Any,
    *,
    messages: list[dict],
    feature_prompt: str,
    context: "AICallContext",
    db: "Session",
    user: "User",
    llm_params: Any = None,
    include_core_prompt: bool = True,
    on_complete: Any = None,
    on_text: Callable[[str], None] | None = None,
    headers: dict[str, str] | None = None,
) -> StreamingResponse:
    """
    Call the model and hand back a typed stream. The whole path, for the common case.

    Failures become an `error` event rather than prose, reasoning becomes `thinking`
    events, and `on_text` receives the finished answer with the reasoning already gone.

    The gateway is passed in rather than reached for, so what a test patches on the
    calling module is what actually runs.
    """
    probe = UsageProbe()
    return sse_response(
        sse_events(
            gateway.stream(
                messages=messages,
                feature_prompt=feature_prompt,
                context=context,
                db=db,
                user=user,
                llm_params=llm_params,
                include_core_prompt=include_core_prompt,
                on_complete=on_complete,
                on_result=probe,
            ),
            # Which endpoint failed, in the vocabulary the call log already uses.
            where=context.feature,
            usage=probe,
            on_text=on_text,
        ),
        headers=headers,
    )
