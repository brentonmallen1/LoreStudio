from pydantic import BaseModel


class SceneCastEntry(BaseModel):
    """Who and what a scene carries, for the story strip and the side panel."""

    node_id: str
    #: Point of view first, then by how often the prose names them.
    character_ids: list[str]
    location_ids: list[str]
    thread_ids: list[str]
    beat_id: str | None
    status: str
    word_count: int
    #: The first words of the prose, plain text, for previews.
    opening: str


class SceneCastOut(BaseModel):
    scenes: list[SceneCastEntry]
