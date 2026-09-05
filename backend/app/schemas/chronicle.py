from datetime import datetime

from pydantic import BaseModel

# ── Chat Messages ──────────────────────────────────────────────────────


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    model: str | None
    tokens_in: int | None
    tokens_out: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    role: str
    content: str
    model: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


# ── Chat Sessions ──────────────────────────────────────────────────────


class ChatSessionOut(BaseModel):
    id: str
    story_id: str
    user_id: str
    context_type: str
    context_id: str | None
    context_label: str
    title: str
    archived: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: str | None = None  # truncated preview of most recent message

    model_config = {"from_attributes": True}


class ChatSessionDetail(ChatSessionOut):
    messages: list[ChatMessageOut] = []


class ChatSessionCreate(BaseModel):
    story_id: str
    context_type: str  # "scene" | "character" | "story" | "panel"
    context_id: str | None = None
    context_label: str = ""
    title: str = ""


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    archived: bool | None = None


# ── Activity Logs ──────────────────────────────────────────────────────


class ActivityLogOut(BaseModel):
    id: str
    user_id: str
    story_id: str | None
    event_type: str
    category: str
    description: str
    metadata_: dict
    starred: bool = False
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ActivityLogUpdate(BaseModel):
    starred: bool | None = None


# ── Search / List responses ────────────────────────────────────────────


class SessionListResponse(BaseModel):
    sessions: list[ChatSessionOut]
    total: int
    page: int
    page_size: int


class ActivityListResponse(BaseModel):
    logs: list[ActivityLogOut]
    total: int
    page: int
    page_size: int


class SearchResult(BaseModel):
    type: str  # "session" | "activity"
    session: ChatSessionOut | None = None
    log: ActivityLogOut | None = None
    excerpt: str = ""  # matched text snippet


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str


class ChronicleStats(BaseModel):
    total_sessions: int
    total_messages: int
    total_activity_logs: int
    sessions_by_type: dict[str, int]
    ai_interactions: int
