from datetime import datetime
from pydantic import BaseModel


class OutlineItemCreate(BaseModel):
    text: str
    parent_id: str | None = None
    position: int = 0
    beat_type: str | None = None
    notes: str = ""


class OutlineItemUpdate(BaseModel):
    text: str | None = None
    parent_id: str | None = None
    position: int | None = None
    beat_type: str | None = None
    notes: str | None = None
    collapsed: bool | None = None


class OutlineItemOut(BaseModel):
    id: str
    story_id: str
    parent_id: str | None
    level: int
    position: int
    text: str
    beat_type: str | None
    notes: str
    collapsed: bool
    created_at: datetime
    updated_at: datetime
    children: list["OutlineItemOut"] = []

    model_config = {"from_attributes": True}


class ReorderPayload(BaseModel):
    parent_id: str | None
    item_ids: list[str]
