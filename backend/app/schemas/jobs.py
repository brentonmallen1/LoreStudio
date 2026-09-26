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

    model_config = {"from_attributes": True}
