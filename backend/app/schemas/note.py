from datetime import datetime
from typing import Literal

from pydantic import BaseModel

NoteKind = Literal["note", "question", "todo", "idea"]
AboutType = Literal["character", "location"]


class NoteCreate(BaseModel):
    #: A margin note's id is chosen by the editor, which marks the passage with it first.
    id: str | None = None
    content: str
    kind: NoteKind = "note"
    node_id: str | None = None
    anchor: str | None = None
    about_type: AboutType | None = None
    about_id: str | None = None
    answer: str = ""
    done: bool = False


class NoteUpdate(BaseModel):
    content: str | None = None
    kind: NoteKind | None = None
    node_id: str | None = None
    anchor: str | None = None
    about_type: AboutType | None = None
    about_id: str | None = None
    answer: str | None = None
    done: bool | None = None
    position: int | None = None


class NoteOut(BaseModel):
    id: str
    story_id: str
    kind: str
    content: str
    node_id: str | None
    anchor: str | None
    about_type: str | None
    about_id: str | None
    answer: str
    done: bool
    source: str | None
    category: str | None
    position: int
    created_at: datetime
    updated_at: datetime
    #: The scene's title, when the note is tied to one.
    node_title: str | None = None

    model_config = {"from_attributes": True}


class ReorderPayload(BaseModel):
    note_ids: list[str]
