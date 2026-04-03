from datetime import datetime
from pydantic import BaseModel


class AssetUpdate(BaseModel):
    alt_text: str | None = None
    description: str | None = None


class AttachmentCreate(BaseModel):
    object_type: str  # character / setting / structure_node / diagram
    object_id: str
    role: str = "reference"


class AttachmentOut(BaseModel):
    id: str
    asset_id: str
    object_type: str
    object_id: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: str
    story_id: str
    original_filename: str
    mime_type: str
    size_bytes: int
    alt_text: str
    description: str
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentOut] = []

    model_config = {"from_attributes": True}
