"""Settings › Automatic work (doc 22)."""

from datetime import datetime

from pydantic import BaseModel


class AutomaticOptionOut(BaseModel):
    key: str
    label: str
    #: number | switch
    kind: str
    unit: str = ""
    min: int = 0
    max: int = 0
    value: int | bool
    default: int | bool


class AutomaticRunOut(BaseModel):
    at: datetime
    summary: str
    ok: bool = True


class AutomaticTaskOut(BaseModel):
    id: str
    label: str
    description: str
    #: schedule | visit | start
    when: str
    enabled: bool
    #: "Every 24 hours, keeping the last 14", from its options.
    cadence: str
    options: list[AutomaticOptionOut]
    last_run: AutomaticRunOut | None = None
    #: A scheduled task that is on: when it is next due.
    next_at: datetime | None = None
    #: The Settings section with the rest of its settings.
    link: str | None = None
    #: A scheduled task can be run now, whatever its schedule.
    can_run_now: bool = False


class AutomaticOut(BaseModel):
    paused: bool
    #: Admins change these; anyone else reads them.
    can_edit: bool
    tasks: list[AutomaticTaskOut]


class AutomaticPatch(BaseModel):
    paused: bool | None = None
    #: {task id: {"enabled": bool, option key: value}}
    tasks: dict[str, dict[str, int | bool]] | None = None
