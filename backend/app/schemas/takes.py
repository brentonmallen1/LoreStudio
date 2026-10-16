"""Scene takes (doc 29 D7): whole-scene versions of one scene's prose, one of which counts."""

from datetime import datetime

from pydantic import BaseModel, Field


class TakeOut(BaseModel):
    id: str
    node_id: str
    #: Its place among the scene's takes, from 1: "Take 2".
    number: int
    label: str
    #: Its prose; for the take that counts, the scene's own.
    content: str
    word_count: int
    #: The take that counts: the scene's prose in the manuscript, exports, counts and checks.
    counts: bool
    #: The take the editor shows, and autosave writes to.
    is_open: bool
    created_at: datetime
    updated_at: datetime


class TakesOut(BaseModel):
    node_id: str
    #: Empty while the scene has one take.
    takes: list[TakeOut]


class TakeRename(BaseModel):
    label: str = Field(max_length=200)


class TakeWrite(BaseModel):
    content: str
    word_count: int = 0
