from datetime import datetime
from typing import Literal
from pydantic import BaseModel


KnowledgeType = Literal[
    "truth_revealed",
    "misdirection_planted",
    "clue_planted",
    "character_learns",
    "reader_only",
]


class ReaderKnowledgeEventCreate(BaseModel):
    node_id: str | None = None
    twist_id: str | None = None
    knowledge_type: KnowledgeType = "truth_revealed"
    subject: str
    detail: str = ""
    reader_knows: bool = True
    characters_who_know: list[str] = []
    is_truth: bool = True
    supersedes_id: str | None = None


class ReaderKnowledgeEventUpdate(BaseModel):
    node_id: str | None = None
    twist_id: str | None = None
    knowledge_type: KnowledgeType | None = None
    subject: str | None = None
    detail: str | None = None
    reader_knows: bool | None = None
    characters_who_know: list[str] | None = None
    is_truth: bool | None = None
    supersedes_id: str | None = None


class ReaderKnowledgeEventOut(BaseModel):
    id: str
    story_id: str
    node_id: str | None
    twist_id: str | None
    knowledge_type: str
    subject: str
    detail: str
    reader_knows: bool
    characters_who_know: list[str]
    is_truth: bool
    supersedes_id: str | None
    created_at: datetime
    updated_at: datetime

    # Denormalized for UI convenience
    node_title: str | None = None
    twist_name: str | None = None

    model_config = {"from_attributes": True}
