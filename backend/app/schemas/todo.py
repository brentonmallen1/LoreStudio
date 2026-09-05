from datetime import datetime

from pydantic import BaseModel


class TodoCreate(BaseModel):
    content: str
    node_id: str | None = None
    done: bool = False
    position: int = 0
    doc_from: int | None = None
    doc_to: int | None = None


class TodoUpdate(BaseModel):
    content: str | None = None
    node_id: str | None = None
    done: bool | None = None
    position: int | None = None
    doc_from: int | None = None
    doc_to: int | None = None


class TodoOut(BaseModel):
    id: str
    story_id: str
    node_id: str | None
    content: str
    done: bool
    position: int
    doc_from: int | None
    doc_to: int | None
    created_at: datetime
    updated_at: datetime

    # Denormalized for convenience — node.title if node exists
    node_title: str | None = None

    model_config = {"from_attributes": True}


class ReorderPayload(BaseModel):
    todo_ids: list[str]
