from datetime import datetime
from pydantic import BaseModel

from .llm_params import LLMParams


class PanelInterviewCreate(BaseModel):
    title: str = ""
    character_ids: list[str]


class PanelMessageRequest(BaseModel):
    content: str
    llm_params: LLMParams | None = None


class PanelMessageOut(BaseModel):
    role: str  # "user" or "panel"
    content: str
    timestamp: str


class PanelInterviewOut(BaseModel):
    id: str
    story_id: str
    title: str
    character_ids: list[str]
    messages: list[PanelMessageOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PanelInterviewSummaryOut(BaseModel):
    id: str
    story_id: str
    title: str
    character_ids: list[str]
    message_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
