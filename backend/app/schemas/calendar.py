from datetime import datetime

from pydantic import BaseModel


class CalendarCreate(BaseModel):
    name: str
    description: str = ""
    months: list = []
    days_per_week: int = 7
    week_day_names: list = []
    special_days: list = []
    epoch_name: str = ""
    conversion_notes: str = ""


class CalendarUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    months: list | None = None
    days_per_week: int | None = None
    week_day_names: list | None = None
    special_days: list | None = None
    epoch_name: str | None = None
    conversion_notes: str | None = None


class CalendarOut(BaseModel):
    id: str
    story_id: str
    name: str
    description: str
    months: list
    days_per_week: int
    week_day_names: list
    special_days: list
    epoch_name: str
    conversion_notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
