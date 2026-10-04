from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

#: Derived from the thread's scenes (doc 18 C1); only "set aside" is the author's to set.
ThreadStatus = Literal["planned", "open", "resolved", "set_aside"]
MiceType = Literal["milieu", "idea", "character", "event"]
#: What a scene does to a thread. The four in the middle are a try and how it goes.
ThreadRole = Literal["opens", "moves", "turns", "complicates", "fails", "fails_worse", "costs", "succeeds", "closes"]
TRY_ROLES = ("fails", "fails_worse", "costs", "succeeds")


class PlotThreadCreate(BaseModel):
    name: str
    description: str = ""
    #: Palette slot 1..8; 0 lets the server pick the least-used one.
    color_slot: int = Field(0, ge=0, le=8)
    mice_type: MiceType | None = None
    set_aside: bool = False


class PlotThreadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color_slot: int | None = Field(None, ge=1, le=8)
    mice_type: MiceType | None = None
    set_aside: bool | None = None


class PlotThreadAppearanceCreate(BaseModel):
    node_id: str
    role: ThreadRole = "moves"
    note: str = ""


class PlotThreadAppearanceUpdate(BaseModel):
    role: ThreadRole | None = None
    note: str | None = None


class PlotThreadAppearanceOut(BaseModel):
    id: str
    thread_id: str
    node_id: str
    role: str
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PlotThreadOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    status: ThreadStatus
    set_aside: bool
    color_slot: int = 0
    mice_type: str | None
    #: Read from the scenes whose role is opens / closes.
    opens_at_node_id: str | None
    closes_at_node_id: str | None
    appearances: list[PlotThreadAppearanceOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
