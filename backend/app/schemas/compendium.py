from datetime import datetime
from pydantic import BaseModel


class CompendiumNoteCreate(BaseModel):
    title: str
    content: str = ""
    tags: list[str] = []
    category: str = "general"
    notes: str = ""


class CompendiumUrlCreate(BaseModel):
    title: str | None = None  # Uses fetched title if omitted
    url: str
    tags: list[str] = []
    category: str = "general"
    notes: str = ""
    fetch_metadata: bool = True


class CompendiumDocumentCreate(BaseModel):
    title: str | None = None  # Uses filename if omitted
    asset_id: str
    tags: list[str] = []
    category: str = "general"
    notes: str = ""


class CompendiumEntryUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    url: str | None = None
    tags: list[str] | None = None
    category: str | None = None
    notes: str | None = None


class CompendiumAttachBody(BaseModel):
    object_type: str
    object_id: str
    note: str = ""


class CompendiumAttachmentOut(BaseModel):
    id: str
    entry_id: str
    object_type: str
    object_id: str
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CompendiumEntryOut(BaseModel):
    id: str
    story_id: str
    title: str
    entry_type: str
    content: str | None
    url: str | None
    url_title: str | None
    url_description: str | None
    url_fetched_at: datetime | None
    asset_id: str | None
    tags: list[str]
    category: str
    notes: str
    attachments: list[CompendiumAttachmentOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompendiumEntrySummary(BaseModel):
    id: str
    story_id: str
    title: str
    entry_type: str
    url: str | None
    url_title: str | None
    asset_id: str | None
    tags: list[str]
    category: str
    attachment_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
