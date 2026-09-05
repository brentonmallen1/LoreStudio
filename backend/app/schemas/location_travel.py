from datetime import datetime

from pydantic import BaseModel


class LocationTravelCreate(BaseModel):
    from_location_id: str
    to_location_id: str
    travel_time: str = ""
    travel_method: str = ""
    condition: str = ""
    notes: str = ""
    bidirectional: bool = True


class LocationTravelUpdate(BaseModel):
    travel_time: str | None = None
    travel_method: str | None = None
    condition: str | None = None
    notes: str | None = None
    bidirectional: bool | None = None


class LocationTravelOut(BaseModel):
    id: str
    from_location_id: str
    to_location_id: str
    travel_time: str
    travel_method: str
    condition: str
    notes: str
    bidirectional: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
