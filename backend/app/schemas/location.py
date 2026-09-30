from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SceneSettingCreate(BaseModel):
    location_id: str
    node_id: str
    role: str = "primary"
    notes: str = ""


class SceneSettingOut(BaseModel):
    id: str
    location_id: str
    node_id: str
    role: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    name: str
    parent_id: str | None = None
    location_type: str = ""
    climate: str = ""
    terrain: str = ""
    political_affiliation: str = ""
    description: str = ""
    atmosphere: str = ""
    history: str = ""
    significance: str = ""
    orbital_period: str = ""
    distance_from_parent: str = ""
    gravity: str = ""
    habitability: str = ""
    radiation_level: str = ""
    position: int = 0
    #: Palette slot 1..8; 0 lets the server pick the least-used one.
    color_slot: int = 0


class LocationUpdate(BaseModel):
    name: str | None = None
    parent_id: str | None = None
    location_type: str | None = None
    climate: str | None = None
    terrain: str | None = None
    political_affiliation: str | None = None
    description: str | None = None
    atmosphere: str | None = None
    history: str | None = None
    significance: str | None = None
    orbital_period: str | None = None
    distance_from_parent: str | None = None
    gravity: str | None = None
    habitability: str | None = None
    radiation_level: str | None = None
    position: int | None = None
    is_stub: bool | None = None
    color_slot: int | None = None


class LocationOut(BaseModel):
    id: str
    story_id: str
    parent_id: str | None
    name: str
    location_type: str
    climate: str
    terrain: str
    political_affiliation: str
    description: str
    atmosphere: str
    history: str
    significance: str
    orbital_period: str
    distance_from_parent: str
    gravity: str
    habitability: str
    radiation_level: str
    position: int
    is_stub: bool
    discovered_from_id: str | None
    discovered_at: datetime | None
    created_at: datetime
    updated_at: datetime
    color_slot: int = 0

    model_config = {"from_attributes": True}


class LocationTree(LocationOut):
    """Location with nested children for tree retrieval."""

    children: list[LocationTree] = []

    model_config = {"from_attributes": True}
