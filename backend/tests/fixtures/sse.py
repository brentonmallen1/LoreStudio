"""Reading the typed event stream back in tests, the way the browser does."""

import json
from typing import Any

Event = tuple[str, dict[str, Any]]


def decode_sse(body: str) -> list[Event]:
    """Every `event:`/`data:` frame in the response, in order."""
    events: list[Event] = []
    for frame in body.split("\n\n"):
        if not frame.strip():
            continue
        name = ""
        data: list[str] = []
        for line in frame.split("\n"):
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                data.append(line[6:])
        events.append((name, json.loads("\n".join(data)) if data else {}))
    return events


def _deltas(body: str, kind: str) -> str:
    return "".join(d.get("delta", "") for name, d in decode_sse(body) if name == kind)


def answer_of(response: Any) -> str:
    """The prose the author sees — reasoning and errors excluded by construction."""
    return _deltas(response.text, "token")


def thinking_of(response: Any) -> str:
    return _deltas(response.text, "thinking")


def error_of(response: Any) -> str | None:
    return next((d.get("message") for name, d in decode_sse(response.text) if name == "error"), None)


def kinds_of(response: Any) -> list[str]:
    return [name for name, _ in decode_sse(response.text)]
