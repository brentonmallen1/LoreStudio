from datetime import datetime
from typing import Any

from pydantic import BaseModel


class TwistCreate(BaseModel):
    name: str
    the_truth: str = ""
    the_misdirection: str = ""
    twist_type: str = "reveal"
    status: str = "planned"
    revealed_at_node_id: str | None = None
    clues: list[Any] = []


class TwistUpdate(BaseModel):
    name: str | None = None
    the_truth: str | None = None
    the_misdirection: str | None = None
    twist_type: str | None = None
    status: str | None = None
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
