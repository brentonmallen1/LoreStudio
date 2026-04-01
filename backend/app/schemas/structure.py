from datetime import datetime
from pydantic import BaseModel


class StructureNodeCreate(BaseModel):
    parent_id: str | None = None
    level: int = 0
    level_type: str = "section"
    title: str = "Untitled"
    synopsis: str = ""
    content: str = ""
    position: int = 0
    status: str = "draft"


class StructureNodeUpdate(BaseModel):
    title: str | None = None
    synopsis: str | None = None
    content: str | None = None
    position: int | None = None
    status: str | None = None
    word_count: int | None = None
    metadata_: dict | None = None


class StructureNodeOut(BaseModel):
    id: str
    story_id: str
    parent_id: str | None
    level: int
    level_type: str
    title: str
    synopsis: str
    content: str
    position: int
    word_count: int
    status: str
    created_at: datetime
    updated_at: datetime
    children: list["StructureNodeOut"] = []

    model_config = {"from_attributes": True}
