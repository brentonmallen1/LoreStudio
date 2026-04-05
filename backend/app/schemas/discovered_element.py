from datetime import datetime
from pydantic import BaseModel


class DiscoveredElementOut(BaseModel):
    id: str
    story_id: str
    element_type: str
    name: str
    description: str
    confidence: float
    source_node_id: str | None
    source_excerpt: str
    status: str
    merged_to_type: str | None
    merged_to_id: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class DiscoveredElementApprove(BaseModel):
    # Optionally override name/description before creating the entity
    name: str | None = None
    description: str | None = None


class DiscoveryRunRequest(BaseModel):
    node_id: str | None = None  # If provided, analyze only this scene; otherwise analyze recent scenes
