from datetime import datetime
from typing import Literal

from pydantic import BaseModel

#: What the editor offers (components/editor/segmentMeta.ts). A callback points back to an
#: earlier scene; foreshadowing points ahead to the payoff.
LinkType = Literal["foreshadowing", "callback", "causes", "parallel", "contrast", "echoes"]


class SceneLinkCreate(BaseModel):
    story_id: str
    source_node_id: str
    target_node_id: str
    link_type: LinkType
    note: str = ""


class SceneLinkUpdate(BaseModel):
    link_type: LinkType | None = None
    note: str | None = None


class SceneLinkOut(BaseModel):
    id: str
    story_id: str
    source_node_id: str
    target_node_id: str
    link_type: str
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}
