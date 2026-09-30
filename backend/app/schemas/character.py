from datetime import datetime

from pydantic import BaseModel


class DiscoveryNote(BaseModel):
    id: str
    text: str
    scene_id: str | None = None
    scene_title: str | None = None
    timestamp: str
    confirmed: bool = False


class DiscoveryNoteCreate(BaseModel):
    text: str
    scene_id: str | None = None
    scene_title: str | None = None


class DiscoveryNoteUpdate(BaseModel):
    text: str | None = None
    confirmed: bool | None = None
    scene_id: str | None = None
    scene_title: str | None = None


class ArcMilestone(BaseModel):
    id: str
    text: str
    completed: bool = False
    scene_id: str | None = None
    scene_title: str | None = None


class CharacterCreate(BaseModel):
    name: str
    role: str = "deuteragonist"
    character_type: str = ""
    jungian_archetype: str = ""
    narrative_archetype: str = ""
    mission_statement: str = ""
    pronouns: str = ""
    personality: str = ""
    motivation: str = ""
    background: str = ""
    appearance: str = ""
    arc_notes: str = ""
    flaws: str = ""
    quirks: str = ""
    speech_patterns: str = ""
    interview_prompts: list[str] = []
    traits: dict = {}
    attributes: dict = {}
    narrative_intent: str = ""
    narrative_intent_hidden: bool = True
    # A character filed from the Idea page arrives with the author's words as a note.
    discovery_notes: list[dict] = []


class CharacterUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    character_type: str | None = None
    jungian_archetype: str | None = None
    narrative_archetype: str | None = None
    mission_statement: str | None = None
    pronouns: str | None = None
    personality: str | None = None
    motivation: str | None = None
    background: str | None = None
    appearance: str | None = None
    arc_notes: str | None = None
    flaws: str | None = None
    quirks: str | None = None
    speech_patterns: str | None = None
    interview_prompts: list[str] | None = None
    traits: dict | None = None
    attributes: dict | None = None
    narrative_intent: str | None = None
    narrative_intent_hidden: bool | None = None
    # Filing from the Idea page adds the author's words as a note (doc 10 P2).
    discovery_notes: list[dict] | None = None
    conflict: str | None = None
    epiphany: str | None = None
    arc_in_own_words: str | None = None


class CharacterOut(BaseModel):
    id: str
    story_id: str
    name: str
    role: str
    character_type: str
    jungian_archetype: str
    narrative_archetype: str
    mission_statement: str
    pronouns: str
    personality: str
    motivation: str
    background: str
    appearance: str
    arc_notes: str
    flaws: str = ""
    quirks: str = ""
    speech_patterns: str = ""
    interview_prompts: list[str]
    traits: dict
    attributes: dict
    narrative_intent: str
    narrative_intent_hidden: bool
    conflict: str
    epiphany: str
    arc_in_own_words: str
    arc_milestones: list[ArcMilestone]
    discovery_notes: list[DiscoveryNote] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrengthDimensions(BaseModel):
    trust: int = 5
    power: int = 5
    affection: int = 5
    tension: int = 5
    openness: int = 5


class RelationshipCreate(BaseModel):
    related_character_id: str
    relationship_type: str = "acquaintance"
    description: str = ""
    strength: StrengthDimensions = StrengthDimensions()
    visibility: str = "public"
    narrative_purpose: list[str] = []
    notes: str = ""
    is_suggested: bool = False
    suggestion_source: str = ""


class RelationshipUpdate(BaseModel):
    relationship_type: str | None = None
    description: str | None = None
    strength: StrengthDimensions | None = None
    visibility: str | None = None
    narrative_purpose: list[str] | None = None
    notes: str | None = None
    is_suggested: bool | None = None
    suggestion_source: str | None = None


class RelationshipOut(BaseModel):
    id: str
    character_id: str
    related_character_id: str
    relationship_type: str
    description: str
    strength: dict
    visibility: str
    narrative_purpose: list[str]
    notes: str
    is_suggested: bool
    suggestion_source: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class RelationshipTemplate(BaseModel):
    id: str
    name: str
    relationship_type: str
    default_strength: StrengthDimensions
    default_narrative_purpose: list[str]
    default_visibility: str
    description_hint: str
