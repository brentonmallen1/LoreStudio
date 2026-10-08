"""Telling the browser which change a request recorded (doc 23 P5b: one undo timeline).

⌘Z undoes the author's last action wherever it happened: typing in the open scene (the
editor's own history) or a change on the server (the change log). To put the two in one
order, the client has to know the moment a request recorded a change, not find out on its
next poll. Every response that recorded an undoable change says so in two headers:

    X-Change-Batch   the batch id
    X-Change-Story   the story it belongs to

Undo and redo themselves are not announced: they move along the timeline, they are not a
new step on it.
"""

from __future__ import annotations

from contextvars import ContextVar

_recorded: ContextVar[list[tuple[str | None, str]] | None] = ContextVar("recorded_changes", default=None)

EXPOSED = ["X-Change-Batch", "X-Change-Story"]


def note(story_id: str | None, batch_id: str) -> None:
    """Called by ``change_log.record`` for a new undoable change. Outside a request, nothing."""
    recorded = _recorded.get()
    if recorded is not None:
        recorded.append((story_id, batch_id))


class ChangeHeaders:
    """Pure ASGI, not ``BaseHTTPMiddleware``: streams pass straight through, and a stream that
    carries on after its window closes (``sse.carry_on``) is not cut off."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        # A list, not a value: the endpoint runs in a copy of this context (the thread pool
        # copies it), and appending to the same list is how its record reaches us.
        recorded: list[tuple[str | None, str]] = []
        token = _recorded.set(recorded)

        async def send_with_headers(message) -> None:
            if message["type"] == "http.response.start" and recorded and message["status"] < 400:
                story_id, batch_id = recorded[-1]
                headers = list(message.get("headers", []))
                headers.append((b"x-change-batch", batch_id.encode()))
                if story_id:
                    headers.append((b"x-change-story", story_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        finally:
            _recorded.reset(token)
