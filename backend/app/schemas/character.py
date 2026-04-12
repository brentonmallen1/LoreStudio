import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class DiscoveryNote(BaseModel):
    id: str
    text: str
    scene_id: Optional[str] = None
    scene_title: Optional[str] = None
    timestamp: str
    confirmed: bool = False


class DiscoveryNoteCreate(BaseModel):
    text: str
    scene_id: Optional[str] = None
    scene_title: Optional[str] = None


class DiscoveryNoteUpdate(BaseModel):
    text: Optional[str] = None
    confirmed: Optional[bool] = None
    scene_id: Optional[str] = None
    scene_title: Optional[str] = None


class ArcMilestone(BaseModel):
    id: str
    text: str
    completed: bool = False
    scene_id: str | None = None
    scene_title: str | None = None


class CharacterCreate(BaseModel):
    name: str
    role: str = "supporting"
    mission_statement: str = ""
    pronouns: str = ""
    personality: str = ""
    motivation: str = ""
    background: str = ""
    appearance: str = ""
    arc_notes: str = ""
    interview_prompts: list[str] = []
    traits: dict = {}
    attributes: dict = {}
    narrative_intent: str = ""
    narrative_intent_hidden: bool = True


class CharacterUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    mission_statement: str | None = None
    pronouns: str | None = None
    personality: str | None = None
    motivation: str | None = None
    background: str | None = None
    appearance: str | None = None
    arc_notes: str | None = None
    interview_prompts: list[str] | None = None
    traits: dict | None = None
    attributes: dict | None = None
    narrative_intent: str | None = None
    narrative_intent_hidden: bool | None = None
    snowflake_summary: str | None = None
    snowflake_synopsis: str | None = None


class CharacterOut(BaseModel):
    id: str
    story_id: str
    name: str
    role: str
    mission_statement: str
    pronouns: str
    personality: str
    motivation: str
    background: str
    appearance: str
    arc_notes: str
    interview_prompts: list[str]
    traits: dict
    attributes: dict
    narrative_intent: str
    narrative_intent_hidden: bool
    snowflake_summary: str
    snowflake_synopsis: str
    arc_milestones: list[ArcMilestone]
    discovery_notes: list[DiscoveryNote] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RelationshipCreate(BaseModel):
    related_character_id: str
    relationship_type: str = "acquaintance"
    description: str = ""


class RelationshipOut(BaseModel):
    id: str
    character_id: str
    related_character_id: str
    relationship_type: str
    description: str

    model_config = {"from_attributes": True}
