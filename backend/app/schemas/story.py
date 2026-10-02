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
    #: Lay out the template's first outline (services/structure_scaffold.py).
    scaffold: bool = True


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
    author_name: str | None = None
    discovery_enabled: bool | None = None
    discovery_auto_analyze: bool | None = None
    discovery_element_types: list[str] | None = None
    discovery_min_confidence: float | None = None
    narrative_perspective: str | None = None
    pov_character_id: str | None = None
    paragraph_summary: str | None = None
    synopsis: str | None = None
    planning_method: str | None = None
    idea_fragments: list[dict] | None = None


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
    author_name: str = ""
    goals: list[StoryGoal]
    discovery_enabled: bool
    discovery_auto_analyze: bool
    discovery_element_types: list[str]
    discovery_min_confidence: float
    narrative_perspective: str
    pov_character_id: str | None
    paragraph_summary: str
    synopsis: str
    planning_method: str
    idea_fragments: list[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StoryCreated(StoryOut):
    """A new story, and the node its first outline opens at (None when nothing was laid out)."""

    start_node_id: str | None = None


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
    category: str = ""


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
    #: The Overview's vitals (doc 12 P6): goals met of set, the next one, and the threads
    #: still open by name, so the numbers can say which.
    goals_done: int = 0
    goals_total: int = 0
    next_goal: str = ""
    open_threads: list[str] = []
    #: The last lines of the scene edited last (doc 14 Overview): the "where you left off"
    #: card shows the writer their own words to pick up from.
    resume_excerpt: list[str] = []


class StoryGoalCreate(BaseModel):
    text: str


class StoryGoalUpdate(BaseModel):
    text: str | None = None
    completed: bool | None = None
