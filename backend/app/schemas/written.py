"""What you've written (doc 29 D6): the Overview's discovery section, read from the prose."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class NamedCount(BaseModel):
    """Someone or somewhere in the Lorebook, and how often the prose names them."""

    id: str
    name: str
    #: Times the prose names them, by any of their names.
    times: int
    #: Scenes they are in: named, seen through, or placed there by the author.
    scenes: int
    color_slot: int | None = None


class NameAction(BaseModel):
    id: str
    label: str


class NewName(BaseModel):
    """A name the prose uses that the Lorebook does not have, from Discoveries' name scan."""

    proposal_id: str
    #: The list it shows in: a name read as a person and as a place shows once, as the likelier.
    kind: Literal["person", "place"]
    name: str
    times: int
    #: The proposal's own yeses, answered through the Discoveries routes: one, or "Add as a
    #: person" and "Add as a place" for a name the scan read as either.
    actions: list[NameAction]
    #: Its "no": "Not a person", "Not a place", or "Neither", which declines both.
    decline: str


class Jump(BaseModel):
    phrase: str
    #: The paragraph's first words, to find it in the editor.
    passage: str


class SplitOffer(BaseModel):
    """A long scene where the time jumps: "Split it there?"."""

    node_id: str
    title: str
    words: int
    jumps: list[Jump]
    #: The rule it was found by, said where the offer shows: scenes of this many words or more.
    long_scene_words: int


class ChaptersOffer(BaseModel):
    """A part holding many scenes: "When you want chapters, wrap some in one"."""

    part_id: str
    title: str
    scenes: int
    #: The level the new parts would be ("chapter"), from the story's shape.
    level: str
    #: The rule: a part holding this many scenes or more.
    many_scenes: int


class WrittenOut(BaseModel):
    people: list[NamedCount]
    places: list[NamedCount]
    new_names: list[NewName]
    #: When the name scan last ran; None until it has.
    last_scan: datetime | None = None
    split_offers: list[SplitOffer]
    chapters_offers: list[ChaptersOffer] = []


class NotNowRequest(BaseModel):
    #: The offer: "split:<scene id>" or "chapters:<part id>".
    key: str
