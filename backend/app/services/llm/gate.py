"""
The model gate: replies first (doc 21 P3, D10).

There is one local model, and it answers one call at a time. Jobs (a check, the summaries,
the editorial pass) share it with the author's own replies (an interview, a chat), and the
replies always go first:

- **A reply preempts a job.** A live call (any call made outside a job) that starts while a
  job's call is running interrupts that job: its call is cancelled, so the connection closes
  and the model stops, and the job goes back to the front of the model lane, to resume at its
  step (`job_queue.interrupt(id, "yield")`).
- **A cool-down after the last reply.** The model lane starts nothing until `cooldown` seconds
  after the last live call ended, so a conversation is never interrupted between turns. Every
  reply restarts the clock. A job the author presses **Start now** on skips the rest of it.
- **A pause.** When the model is not answering, or the author switched AI off, the lane waits
  rather than failing each job in turn; Start now ends the wait.

A provider that serves several calls at once would not need any of this; the only provider
today is Ollama, so `exclusive` is always on.

State lives in this process, like the queue's workers. Waiting is a short poll, not an
asyncio primitive, so the gate is not tied to one event loop (tests run several).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime

#: The cool-down when the author has not chosen one (Settings › AI).
DEFAULT_COOLDOWN = 60
#: How long a paused lane waits before trying the model again.
PAUSE_SECONDS = 30
POLL = 0.25


@dataclass
class LiveCall:
    """A reply in flight, as the Jobs list shows it in every window: what it is, whose, and
    whether Stop can reach it (a stream checks between chunks; a one-shot call cannot)."""

    user_id: str
    label: str
    session_id: str | None = None
    can_stop: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    stop_requested: bool = False


class ModelGate:
    def __init__(self) -> None:
        self.exclusive = True
        self.cooldown = float(DEFAULT_COOLDOWN)
        #: Replies in flight, by id.
        self._live: dict[str, LiveCall] = {}
        self._last_live_end = 0.0
        #: Jobs with a model call in flight, by job id.
        self._job_calls: set[str] = set()
        #: Jobs the author said to start now: they skip the cool-down (and a pause) once.
        self._start_now: set[str] = set()
        self._paused_until = 0.0
        self._pause_reason = ""

    # ── what the lane is waiting for ──────────────────────────────────────

    def cooldown_left(self, now: float | None = None) -> float:
        if not self.exclusive or self._last_live_end == 0:
            return 0.0
        return max(0.0, self._last_live_end + self.cooldown - (now or time.monotonic()))

    def replying(self) -> bool:
        return bool(self._live)

    def waiting_reason(self, job_id: str | None = None, user_id: str | None = None) -> str | None:
        """Why a model job is not running yet, in the author's words, or None if it may.
        A reply of the job's own author is named; anyone else's is not."""
        if job_id and job_id in self._start_now:
            return None
        if self._paused_until > time.monotonic():
            left = int(self._paused_until - time.monotonic()) + 1
            return f"{self._pause_reason} Trying again in {left} s"
        if not self.exclusive:
            return None
        if self._live:
            mine = next((c for c in self._live.values() if user_id and c.user_id == user_id), None)
            return f"Waiting: {mine.label} goes first" if mine else "Waiting: a reply goes first"
        left = self.cooldown_left()
        if left > 0:
            return f"Waiting: starts {int(left) + 1} s after your last reply"
        return None

    def may_start(self, job_id: str | None = None) -> bool:
        return self.waiting_reason(job_id) is None

    async def wait_turn(self, job_id: str | None = None) -> None:
        """Until a job may use the model: no reply running, the cool-down over, no pause."""
        while not self.may_start(job_id):
            await asyncio.sleep(POLL)

    # ── the author's word ─────────────────────────────────────────────────

    def start_now(self, job_id: str) -> None:
        """Skip the cool-down (or a pause) for this job. A reply still goes first."""
        self._start_now.add(job_id)
        self._paused_until = 0.0

    def finished(self, job_id: str) -> None:
        self._start_now.discard(job_id)

    def pause(self, reason: str, seconds: float = PAUSE_SECONDS) -> None:
        self._paused_until = time.monotonic() + seconds
        self._pause_reason = reason

    # ── calls ─────────────────────────────────────────────────────────────

    def calls(self, user_id: str) -> list[LiveCall]:
        """This author's replies in flight, oldest first."""
        return sorted((c for c in self._live.values() if c.user_id == user_id), key=lambda c: c.started_at)

    def stop(self, call_id: str, user_id: str) -> bool:
        """Stop a reply from any window: the stream ends at its next chunk, logged as stopped."""
        call = self._live.get(call_id)
        if call is None or call.user_id != user_id or not call.can_stop:
            return False
        call.stop_requested = True
        return True

    @asynccontextmanager
    async def live(
        self,
        cooldown: float | None = None,
        *,
        user_id: str = "",
        label: str = "A reply",
        session_id: str | None = None,
        can_stop: bool = False,
    ) -> AsyncIterator[LiveCall]:
        """A reply: it goes now, and makes any job's call in flight give way."""
        from ..job_queue import interrupt

        call = LiveCall(user_id=user_id, label=label, session_id=session_id, can_stop=can_stop)
        self._live[call.id] = call
        if self.exclusive:
            for job_id in list(self._job_calls):
                interrupt(job_id, "yield")
        try:
            yield call
        finally:
            self._live.pop(call.id, None)
            self._last_live_end = time.monotonic()
            if cooldown is not None:
                self.cooldown = float(cooldown)

    @asynccontextmanager
    async def job(self, job_id: str) -> AsyncIterator[None]:
        """A job's call: it waits its turn, then is marked in flight so a reply can stop it."""
        await self.wait_turn(job_id)
        self._job_calls.add(job_id)
        try:
            yield None
        finally:
            self._job_calls.discard(job_id)


model_gate = ModelGate()


def cooldown_for(user: object) -> int:
    """The author's cool-down in seconds (Settings › AI), or the default."""
    settings = getattr(user, "settings", None) or {}
    value = settings.get("ai", {}).get("jobs_cooldown_seconds")
    return int(value) if isinstance(value, int | float) and value >= 0 else DEFAULT_COOLDOWN
