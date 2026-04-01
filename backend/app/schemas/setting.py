from datetime import datetime
from pydantic import BaseModel


class SettingCreate(BaseModel):
    name: str
    description: str = ""
    atmosphere: str = ""
    history: str = ""
    significance: str = ""


class SettingUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    atmosphere: str | None = None
    history: str | None = None
    significance: str | None = None


class SettingOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    atmosphere: str
    history: str
    significance: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
