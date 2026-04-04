from pydantic import BaseModel


class BeatOut(BaseModel):
    id: str
    name: str
    position_pct: float
    description: str = ""


class BeatSheetOut(BaseModel):
    id: str
    name: str
    description: str
    is_system: bool
    user_id: str | None
    beats: list[BeatOut]

    model_config = {"from_attributes": True}


class BeatSheetCreate(BaseModel):
    name: str
    description: str = ""
    beats: list[BeatOut] = []
