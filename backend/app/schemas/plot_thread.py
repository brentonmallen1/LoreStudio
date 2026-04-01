from datetime import datetime
from pydantic import BaseModel


class PlotThreadCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "open"
    color: str = "#6b7280"


class PlotThreadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    color: str | None = None


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
    appearances: list[PlotThreadAppearanceOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
