from datetime import datetime
from pydantic import BaseModel


# ── Outline ────────────────────────────────────────────────────────────────────

class OutlineCreate(BaseModel):
    name: str = "Outline"


class OutlineUpdate(BaseModel):
    name: str | None = None
    position: int | None = None


class OutlineOut(BaseModel):
    id: str
    story_id: str
    name: str
    position: int
    source_beat_sheet_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OutlineWithItemsOut(OutlineOut):
    items: list["OutlineItemOut"] = []


class InjectBeatSheetPayload(BaseModel):
    beat_sheet_id: str


# ── OutlineItem ────────────────────────────────────────────────────────────────

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
    outline_id: str
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


class BulkReorderOp(BaseModel):
    item_id: str
    parent_id: str | None
    position: int


class BulkReorderPayload(BaseModel):
    operations: list[BulkReorderOp]
