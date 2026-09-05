from datetime import datetime

from pydantic import BaseModel


class DiagramCreate(BaseModel):
    title: str
    description: str = ""
    diagram_type: str = "mindmap"
    nodes: list = []
    edges: list = []
    attached_node_id: str | None = None


class DiagramUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    diagram_type: str | None = None
    nodes: list | None = None
    edges: list | None = None
    attached_node_id: str | None = None


class DiagramOut(BaseModel):
    id: str
    story_id: str
    title: str
    description: str
    diagram_type: str
    nodes: list
    edges: list
    attached_node_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DiagramSummary(BaseModel):
    id: str
    story_id: str
    title: str
    description: str
    diagram_type: str
    attached_node_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
