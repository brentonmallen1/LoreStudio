from datetime import datetime

from pydantic import BaseModel


class EraCreate(BaseModel):
    name: str
    description: str = ""
    start_date: str = ""
    end_date: str = ""
    characteristics: str = ""
    key_figures: list = []
    position: int = 0


class EraUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    characteristics: str | None = None
    key_figures: list | None = None
    position: int | None = None


class EraOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    start_date: str
    end_date: str
    characteristics: str
    key_figures: list
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HistoricalEventCreate(BaseModel):
    name: str
    era_id: str | None = None
    description: str = ""
    in_world_date: str = ""
    participants: list = []
    causes: str = ""
    consequences: str = ""
    legacy_effects: str = ""
    position: int = 0


class HistoricalEventUpdate(BaseModel):
    name: str | None = None
    era_id: str | None = None
    description: str | None = None
    in_world_date: str | None = None
    participants: list | None = None
    causes: str | None = None
    consequences: str | None = None
    legacy_effects: str | None = None
    position: int | None = None


class HistoricalEventOut(BaseModel):
    id: str
    story_id: str
    era_id: str | None
    name: str
    description: str
    in_world_date: str
    participants: list
    causes: str
    consequences: str
    legacy_effects: str
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
