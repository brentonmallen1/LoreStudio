import uuid
from datetime import datetime
from pydantic import BaseModel


class StoryGoal(BaseModel):
    id: str
    text: str
    completed: bool = False


class StoryCreate(BaseModel):
    title: str
    description: str = ""
    intent: str = ""
    structure_template_id: str = "freeform"


class StoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    intent: str | None = None
    structure_template_id: str | None = None
    genre: str | None = None
    tone: str | None = None
    themes: list[str] | None = None
    central_conflict: str | None = None
    target_audience: str | None = None
    intended_length: str | None = None
    beat_sheet_id: str | None = None
    narrative_intent: str | None = None
    premise: str | None = None
    logline: str | None = None
    discovery_enabled: bool | None = None
    discovery_auto_analyze: bool | None = None
    discovery_element_types: list[str] | None = None
    discovery_min_confidence: float | None = None
    narrative_perspective: str | None = None
    pov_character_id: str | None = None
    snowflake_sentence: str | None = None
    snowflake_paragraph: str | None = None
    snowflake_synopsis: str | None = None


class StoryOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    intent: str
    structure_template_id: str
    genre: str
    tone: str
    themes: list[str]
    central_conflict: str
    target_audience: str
    intended_length: str
    beat_sheet_id: str | None
    narrative_intent: str
    premise: str
    logline: str
    goals: list[StoryGoal]
    discovery_enabled: bool
    discovery_auto_analyze: bool
    discovery_element_types: list[str]
    discovery_min_confidence: float
    narrative_perspective: str
    pov_character_id: str | None
    snowflake_sentence: str
    snowflake_paragraph: str
    snowflake_synopsis: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecentScene(BaseModel):
    id: str
    title: str
    word_count: int
    status: str
    level_type: str
    updated_at: datetime


class RecentActivity(BaseModel):
    event_type: str
    description: str
    created_at: datetime


class RecentInterview(BaseModel):
    id: str
    character_id: str
    character_name: str
    title: str
    updated_at: datetime


class DistributionEntry(BaseModel):
    id: str
    title: str
    level_type: str
    word_count: int
    scene_count: int
    pct: float  # % of total word count


class StoryOverview(BaseModel):
    word_count: int
    word_count_target: dict | None
    scene_count: int
    scenes_by_status: dict[str, int]
    character_count: int
    thread_counts: dict[str, int]
    recent_scenes: list[RecentScene]
    recent_activity: list[RecentActivity]
    recent_interviews: list[RecentInterview]
    distribution: list[DistributionEntry]


class StoryGoalCreate(BaseModel):
    text: str


class StoryGoalUpdate(BaseModel):
    text: str | None = None
    completed: bool | None = None
