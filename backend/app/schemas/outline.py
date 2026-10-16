"""The Outline's Not placed yet tray (doc 29 D3): ideas without a place yet."""

from pydantic import BaseModel, Field


class TrayItemOut(BaseModel):
    id: str
    text: str
    notes: str
    position: int

    model_config = {"from_attributes": True}


class TrayItemCreate(BaseModel):
    text: str = Field(min_length=1)
    notes: str = ""
    #: Where in the tray; the end when left out.
    position: int | None = None


class TrayItemsCreate(BaseModel):
    """Several ideas at once, as one change (the picks of Fill the tray from my prose)."""

    items: list[TrayItemCreate]


class TrayItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    notes: str | None = None


class TrayReorder(BaseModel):
    item_ids: list[str]


class TrayPlace(BaseModel):
    """Where an idea becomes a planned scene: under a part (or at the top), at a position."""

    parent_id: str | None = None
    position: int = 0
    level: int = 0
    level_type: str = "scene"
