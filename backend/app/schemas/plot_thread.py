from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ThreadStatus = Literal["open", "developing", "resolved"]
MiceType = Literal["milieu", "idea", "character", "event"]


class PlotThreadCreate(BaseModel):
    name: str
    description: str = ""
    status: ThreadStatus = "open"
    #: Palette slot 1..8; 0 lets the server pick the least-used one.
    color_slot: int = Field(0, ge=0, le=8)
    mice_type: MiceType | None = None
    opens_at_node_id: str | None = None
    closes_at_node_id: str | None = None
    try_fail_cycles: list[Any] = []


class PlotThreadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ThreadStatus | None = None
    color_slot: int | None = Field(None, ge=1, le=8)
    mice_type: MiceType | None = None
    opens_at_node_id: str | None = None
    closes_at_node_id: str | None = None
    try_fail_cycles: list[Any] | None = None


class PlotThreadAppearanceCreate(BaseModel):
    node_id: str
    note: str = ""


class PlotThreadAppearanceOut(BaseModel):
    id: str
    thread_id: str
    node_id: str
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PlotThreadOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    status: str
    color_slot: int = 0
    mice_type: str | None
    opens_at_node_id: str | None
    closes_at_node_id: str | None
    try_fail_cycles: list[Any]
    appearances: list[PlotThreadAppearanceOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
