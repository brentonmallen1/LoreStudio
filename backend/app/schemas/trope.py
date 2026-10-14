from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

#: What the author does with a trope (doc 27); "undecided" until they say.
TropeStance = Literal["undecided", "straight", "subverted", "inverted", "averted", "deconstructed", "lampshaded"]
#: Stances that promise the expectation will be turned, so the thread that tracks it should turn.
TURNING_STANCES = ("subverted", "inverted", "deconstructed")


class TropeCreate(BaseModel):
    name: str
    stance: TropeStance = "undecided"
    why: str = ""
    thread_id: str | None = None
    definition_id: str | None = None


class TropeUpdate(BaseModel):
    name: str | None = None
    stance: TropeStance | None = None
    why: str | None = None
    thread_id: str | None = None
    definition_id: str | None = None


class TropeLinkCreate(BaseModel):
    """Where the trope plays: exactly one of a character, a relationship or a scene."""

    character_id: str | None = None
    relationship_id: str | None = None
    node_id: str | None = None
    note: str = ""

    @model_validator(mode="after")
    def _one_target(self) -> "TropeLinkCreate":
        if sum(1 for v in (self.character_id, self.relationship_id, self.node_id) if v) != 1:
            raise ValueError("A trope plays in one place: a character, a relationship or a scene")
        return self


class TropeLinkUpdate(BaseModel):
    note: str | None = None


class TropeReorder(BaseModel):
    ids: list[str]


class TropeLinkOut(BaseModel):
    id: str
    trope_id: str
    character_id: str | None
    relationship_id: str | None
    node_id: str | None
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TropeOut(BaseModel):
    id: str
    story_id: str
    name: str
    stance: str
    why: str
    #: Only ids that still name a row of this story; a deleted thread or entry reads as none.
    thread_id: str | None
    definition_id: str | None
    position: int
    links: list[TropeLinkOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
