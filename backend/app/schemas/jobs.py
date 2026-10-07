from datetime import datetime

from pydantic import BaseModel


class JobOut(BaseModel):
    id: str
    kind: str
    label: str
    status: str
    story_id: str | None
    params: dict = {}
    progress: int
    total: int
    result: dict | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    # Doc 21: the queue
    lane: str = "model"
    origin: str = "author"
    origin_note: str | None = None
    quiet: bool = False
    step_label: str | None = None
    seen_at: datetime | None = None
    retry_of: str | None = None
    attempts: int = 0
    story_title: str | None = None
    #: 1 for the next to run in its lane; None unless queued.
    queue_position: int | None = None
    cancel_requested: bool = False
    #: now | between: whether Stop stops it at once or after the step in hand.
    stop: str = "between"
    #: Why a model job is not running yet (a reply, the cool-down, a pause), or None.
    waiting: str | None = None
    #: The next model job, held by the cool-down or a pause: the author may start it now.
    can_start_now: bool = False

    model_config = {"from_attributes": True}


class JobIds(BaseModel):
    ids: list[str]
