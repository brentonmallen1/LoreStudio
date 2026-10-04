from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TwistType = Literal["reveal", "reversal", "identity", "unreliable_narrator", "red_herring"]
#: Derived from the clues and the reveal scene (doc 18 C1).
TwistStatus = Literal["planned", "seeding", "revealed"]
PointsTo = Literal["truth", "misdirection"]
Subtlety = Literal["obvious", "moderate", "subtle", "hidden"]


class TwistClueCreate(BaseModel):
    node_id: str | None = None
    text: str = ""
    points_to: PointsTo = "truth"
    subtlety: Subtlety = "moderate"
    quote: str = ""


class TwistClueUpdate(BaseModel):
    node_id: str | None = None
    text: str | None = None
    points_to: PointsTo | None = None
    subtlety: Subtlety | None = None
    quote: str | None = None
    position: int | None = None


class TwistClueOut(BaseModel):
    id: str
    twist_id: str
    node_id: str | None
    text: str
    points_to: str
    subtlety: str
    quote: str
    position: int

    model_config = {"from_attributes": True}


class TwistCreate(BaseModel):
    name: str
    the_truth: str = ""
    the_misdirection: str = ""
    twist_type: TwistType = "reveal"
    revealed_at_node_id: str | None = None
    color_slot: int = Field(7, ge=1, le=8)


class TwistUpdate(BaseModel):
    name: str | None = None
    the_truth: str | None = None
    the_misdirection: str | None = None
    twist_type: TwistType | None = None
    revealed_at_node_id: str | None = None
    color_slot: int | None = Field(None, ge=1, le=8)


class TwistOut(BaseModel):
    id: str
    story_id: str
    name: str
    the_truth: str
    the_misdirection: str
    twist_type: str
    status: TwistStatus
    color_slot: int
    revealed_at_node_id: str | None
    clues: list[TwistClueOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
