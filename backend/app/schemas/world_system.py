from datetime import datetime
from pydantic import BaseModel


class HierarchyTier(BaseModel):
    name: str
    description: str = ""
    examples: list[str] = []


class WorldSystemCreate(BaseModel):
    name: str
    system_type: str = ""
    source_origin: str = ""
    rules: str = ""
    limitations: str = ""
    costs: str = ""
    hierarchy_tiers: list[dict] = []
    notes: str = ""


class WorldSystemUpdate(BaseModel):
    name: str | None = None
    system_type: str | None = None
    source_origin: str | None = None
    rules: str | None = None
    limitations: str | None = None
    costs: str | None = None
    hierarchy_tiers: list[dict] | None = None
    notes: str | None = None


class WorldSystemOut(BaseModel):
    id: str
    story_id: str
    name: str
    system_type: str
    source_origin: str
    rules: str
    limitations: str
    costs: str
    hierarchy_tiers: list[dict]
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
