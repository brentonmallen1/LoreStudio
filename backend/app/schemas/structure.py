from datetime import datetime

from pydantic import BaseModel


class ReorderOperation(BaseModel):
    node_id: str
    parent_id: str | None
    position: int
    #: The level's name when the row moves a level (the Outline's Tab and Shift+Tab, doc 29 D2).
    level_type: str | None = None


class ReorderStructurePayload(BaseModel):
    operations: list[ReorderOperation]


class StructureNodeCreate(BaseModel):
    parent_id: str | None = None
    level: int = 0
    level_type: str = "section"
    title: str = "Untitled"
    synopsis: str = ""
    content: str = ""
    position: int = 0
    status: str = "draft"
    purpose: str = ""
    beat_id: str | None = None
    #: Make room at `position`: the siblings from there on move down one (the Outline's Enter
    #: adds a line in the middle, doc 29 D2). Left off, the node goes where it is told.
    insert: bool = False


class StructureNodeUpdate(BaseModel):
    title: str | None = None
    level: int | None = None
    level_type: str | None = None
    synopsis: str | None = None
    content: str | None = None
    position: int | None = None
    status: str | None = None
    word_count: int | None = None
    entry_state: str | None = None
    exit_state: str | None = None
    key_events: str | None = None
    timeline_position: int | None = None
    in_world_date: str | None = None
    era_id: str | None = None
    content_summary: str | None = None
    summary_stale: bool | None = None
    beat_id: str | None = None
    pov_character_id: str | None = None
    purpose: str | None = None
    metadata_: dict | None = None
    #: In a script adapted from a novel, the novel's scene this one tells (doc 25, P10).
    adapted_from_id: str | None = None
    # Optimistic concurrency: the updated_at the client last saw. A mismatch is a 409.
    expected_updated_at: datetime | None = None


class StructureNodeOut(BaseModel):
    id: str
    story_id: str
    parent_id: str | None
    level: int
    level_type: str
    title: str
    synopsis: str
    content: str
    position: int
    word_count: int
    line_count: int = 0
    interior: str = ""
    time_of_day: str = ""
    adapted_from_id: str | None = None
    status: str
    entry_state: str = ""
    exit_state: str = ""
    key_events: str = ""
    timeline_position: int | None = None
    in_world_date: str = ""
    era_id: str | None = None
    content_summary: str = ""
    summary_stale: bool = True
    summary_updated_at: datetime | None = None
    beat_id: str | None = None
    pov_character_id: str | None = None
    purpose: str = ""
    metadata_: dict = {}
    created_at: datetime
    updated_at: datetime
    children: list["StructureNodeOut"] = []

    model_config = {"from_attributes": True}


class StructureNodeMeta(BaseModel):
    """Lightweight node schema for tree/sidebar — excludes content and content_summary prose."""

    id: str
    story_id: str
    parent_id: str | None
    level: int
    level_type: str
    title: str
    synopsis: str
    position: int
    word_count: int
    line_count: int = 0
    interior: str = ""
    time_of_day: str = ""
    adapted_from_id: str | None = None
    status: str
    entry_state: str = ""
    exit_state: str = ""
    key_events: str = ""
    timeline_position: int | None = None
    in_world_date: str = ""
    era_id: str | None = None
    summary_stale: bool = True
    summary_updated_at: datetime | None = None
    beat_id: str | None = None
    pov_character_id: str | None = None
    metadata_: dict = {}
    created_at: datetime
    updated_at: datetime
    #: A scene with words and no line of what happens: its first sentence (doc 29 D6).
    first_line: str = ""
    children: list["StructureNodeMeta"] = []

    model_config = {"from_attributes": True}
