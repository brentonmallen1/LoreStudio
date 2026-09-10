from datetime import datetime

from pydantic import BaseModel


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
