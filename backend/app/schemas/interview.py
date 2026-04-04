from datetime import datetime
from pydantic import BaseModel

from .llm_params import LLMParams


class InterviewCreate(BaseModel):
    title: str = ""
    context_node_id: str | None = None


class InterviewMessageRequest(BaseModel):
    content: str
    llm_params: LLMParams | None = None


class MessageOut(BaseModel):
    role: str
    content: str
    timestamp: str


class InterviewUpdate(BaseModel):
    interview_notes: str | None = None
    title: str | None = None


class InterviewApplyRequest(BaseModel):
    fields: list[str]  # e.g. ["personality", "motivation", "background"]
    content: dict[str, str]  # field_name -> text to set/append


class InterviewOut(BaseModel):
    id: str
    character_id: str
    title: str
    context_node_id: str | None = None
    messages: list[MessageOut]
    interview_notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InterviewSummaryOut(BaseModel):
    id: str
    character_id: str
    title: str
    message_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
