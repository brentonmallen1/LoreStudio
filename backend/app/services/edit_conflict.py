"""
Saving over a newer copy: an editor's autosave sends back the ``updated_at`` it loaded
(``expected_updated_at``), and a row changed since (another window, an undo, a replace) answers
409 with the row as it now stands, so the writer chooses Keep mine or Take theirs. The scene's
prose and a take that does not count (doc 29 D7) are guarded alike.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from fastapi import HTTPException, status


def changed_since(expected: datetime, actual: datetime) -> bool:
    """
    Compare ignoring timezone awareness. The client sends back the exact string it was
    given, so the only slack needed is a millisecond, for a value that went through a
    JavaScript Date. It used to be a whole second, which let a second tab's save — or a
    bulk rewrite — land unopposed if it came within a second of the load.
    """
    e = expected.replace(tzinfo=None)
    a = actual.replace(tzinfo=None)
    return abs((e - a).total_seconds()) > 0.001


def refuse_if_changed(
    expected: datetime | None,
    actual: datetime | None,
    *,
    message: str,
    key: str,
    current: Callable[[], dict],
) -> None:
    """A 409 whose detail is ``{"message": message, key: current()}`` when the row moved on since
    the client loaded it; nothing when the client sent no stamp (Keep mine)."""
    if expected is not None and actual is not None and changed_since(expected, actual):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": message, key: current()})
