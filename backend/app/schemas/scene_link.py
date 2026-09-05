from datetime import datetime

from pydantic import BaseModel


class SceneLinkCreate(BaseModel):
    story_id: str
    source_node_id: str
    target_node_id: str
    link_type: str
    note: str = ""


class SceneLinkUpdate(BaseModel):
    link_type: str | None = None
    note: str | None = None


class SceneLinkOut(BaseModel):
    id: str
    story_id: str
    source_node_id: str
    target_node_id: str
    link_type: str
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}
