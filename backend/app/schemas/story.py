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
    narrative_intent: str | None = None
    premise: str | None = None
    logline: str | None = None


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
    narrative_intent: str
    premise: str
    logline: str
    goals: list[StoryGoal]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StoryGoalCreate(BaseModel):
    text: str


class StoryGoalUpdate(BaseModel):
    text: str | None = None
    completed: bool | None = None
