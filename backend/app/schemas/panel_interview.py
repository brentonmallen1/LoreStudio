from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from .llm_params import LLMParamsOverride
from .mentions import MentionedRef


class PanelSettings(BaseModel):
    max_rounds: int = Field(default=2, ge=1, le=4)


class PanelInterviewCreate(BaseModel):
    title: str = ""
    character_ids: list[str]
    settings: PanelSettings | None = None


class PanelInterviewUpdate(BaseModel):
    title: str | None = None
    settings: PanelSettings | None = None


class PanelMessageRequest(BaseModel):
    content: str
    llm_params: LLMParamsOverride | None = None
    response_length: Literal["brief", "normal", "detailed"] | None = None
    #: What the author @mentioned in the composer (doc 11 P6).
    mentioned_refs: list[MentionedRef] = []


class PanelMessageOut(BaseModel):
    role: str  # "user" | "character"
    content: str
    timestamp: str
    character_id: str | None = None
    character_name: str | None = None


class PanelInterviewOut(BaseModel):
    id: str
    story_id: str
    title: str
    character_ids: list[str]
    messages: list[PanelMessageOut]
    settings: dict = {}
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
