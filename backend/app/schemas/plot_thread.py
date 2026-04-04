from datetime import datetime
from typing import Any
from pydantic import BaseModel


class PlotThreadCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "open"
    color: str = "#6b7280"
    mice_type: str | None = None
    opens_at_node_id: str | None = None
    closes_at_node_id: str | None = None
    try_fail_cycles: list[Any] = []


class PlotThreadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    color: str | None = None
    mice_type: str | None = None
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
    color: str
    mice_type: str | None
    opens_at_node_id: str | None
    closes_at_node_id: str | None
    try_fail_cycles: list[Any]
    appearances: list[PlotThreadAppearanceOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
