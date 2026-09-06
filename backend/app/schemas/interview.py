from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from .llm_params import LLMParamsOverride

KnowledgeScopeValue = Literal["profile", "present", "as_of", "omniscient"]


class InterviewCreate(BaseModel):
    title: str = ""
    context_node_id: str | None = None
    #: "profile" (outside the story), "present" (scenes they are in), "as_of" (up to the
    #: node), "omniscient" (the whole manuscript as a hypothetical).
    knowledge_scope: KnowledgeScopeValue = "profile"


class InterviewMessageRequest(BaseModel):
    content: str
    llm_params: LLMParamsOverride | None = None


class MessageOut(BaseModel):
    role: str
    content: str
    timestamp: str


class InterviewUpdate(BaseModel):
    interview_notes: str | None = None
    title: str | None = None
    #: Changing the scope re-points what the character may draw on. "as_of" needs a node;
    #: the other two clear it.
    knowledge_scope: KnowledgeScopeValue | None = None
    context_node_id: str | None = None


class InterviewApplyRequest(BaseModel):
    fields: list[str]  # e.g. ["personality", "motivation", "background"]
    content: dict[str, str]  # field_name -> text to set/append


class InterviewOut(BaseModel):
    id: str
    character_id: str
    title: str
    context_node_id: str | None = None
    knowledge_scope: str = "profile"
    messages: list[MessageOut]
    interview_notes: str
    compacted_summary: str | None = None
    compaction_count: int = 0
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
