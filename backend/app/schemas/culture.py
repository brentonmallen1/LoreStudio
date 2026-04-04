from datetime import datetime
from pydantic import BaseModel


class CultureCreate(BaseModel):
    name: str
    description: str = ""
    values: str = ""
    customs: str = ""
    taboos: str = ""
    religion: str = ""
    government_type: str = ""
    economy: str = ""
    social_hierarchy: str = ""
    naming_conventions: dict = {}
    common_phrases: list = []
    notes: str = ""


class CultureUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    values: str | None = None
    customs: str | None = None
    taboos: str | None = None
    religion: str | None = None
    government_type: str | None = None
    economy: str | None = None
    social_hierarchy: str | None = None
    naming_conventions: dict | None = None
    common_phrases: list | None = None
    notes: str | None = None


class CultureOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    values: str
    customs: str
    taboos: str
    religion: str
    government_type: str
    economy: str
    social_hierarchy: str
    naming_conventions: dict
    common_phrases: list
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
