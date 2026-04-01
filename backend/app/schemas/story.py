from datetime import datetime
from pydantic import BaseModel


class StoryCreate(BaseModel):
    title: str
    description: str = ""
    intent: str = ""
    structure_template_id: str = "freeform"


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    intent: str | None = None
    structure_template_id: str | None = None


class StoryOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    intent: str
    structure_template_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
