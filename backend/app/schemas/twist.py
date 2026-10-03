from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

TwistType = Literal["reveal", "reversal", "identity", "unreliable_narrator", "red_herring"]
TwistStatus = Literal["planned", "seeding", "revealed"]


class TwistCreate(BaseModel):
    name: str
    the_truth: str = ""
    the_misdirection: str = ""
    twist_type: TwistType = "reveal"
    status: TwistStatus = "planned"
    revealed_at_node_id: str | None = None
    clues: list[Any] = []


class TwistUpdate(BaseModel):
    name: str | None = None
    the_truth: str | None = None
    the_misdirection: str | None = None
    twist_type: TwistType | None = None
    status: TwistStatus | None = None
    revealed_at_node_id: str | None = None
    clues: list[Any] | None = None


class TwistOut(BaseModel):
    id: str
    story_id: str
    name: str
    the_truth: str
    the_misdirection: str
    twist_type: str
    status: str
    revealed_at_node_id: str | None
    clues: list[Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
