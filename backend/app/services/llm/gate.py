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
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

#: The cool-down when the author has not chosen one (Settings › AI).
DEFAULT_COOLDOWN = 60
#: How long a paused lane waits before trying the model again.
PAUSE_SECONDS = 30
POLL = 0.25


class ModelGate:
    def __init__(self) -> None:
        self.exclusive = True
        self.cooldown = float(DEFAULT_COOLDOWN)
        self._live = 0
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

    def waiting_reason(self, job_id: str | None = None) -> str | None:
        """Why a model job is not running yet, in the author's words, or None if it may."""
        if job_id and job_id in self._start_now:
            return None
        if self._paused_until > time.monotonic():
            left = int(self._paused_until - time.monotonic()) + 1
            return f"{self._pause_reason} Trying again in {left} s"
        if not self.exclusive:
            return None
        if self._live:
            return "Waiting: your reply goes first"
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

    @asynccontextmanager
    async def live(self, cooldown: float | None = None) -> AsyncIterator[None]:
        """A reply: it goes now, and makes any job's call in flight give way."""
        from ..job_queue import interrupt

        self._live += 1
        if self.exclusive:
            for job_id in list(self._job_calls):
                interrupt(job_id, "yield")
        try:
            yield
        finally:
            self._live -= 1
            self._last_live_end = time.monotonic()
            if cooldown is not None:
                self.cooldown = float(cooldown)

    @asynccontextmanager
    async def job(self, job_id: str) -> AsyncIterator[None]:
        """A job's call: it waits its turn, then is marked in flight so a reply can stop it."""
        await self.wait_turn(job_id)
        self._job_calls.add(job_id)
        try:
            yield
        finally:
            self._job_calls.discard(job_id)


model_gate = ModelGate()


def cooldown_for(user: object) -> int:
    """The author's cool-down in seconds (Settings › AI), or the default."""
    settings = getattr(user, "settings", None) or {}
    value = settings.get("ai", {}).get("jobs_cooldown_seconds")
    return int(value) if isinstance(value, int | float) and value >= 0 else DEFAULT_COOLDOWN
