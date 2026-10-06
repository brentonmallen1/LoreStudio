"""
Who are they (doc 20): the fields that say who a person is, and the two small lists a character
owns, Body and mind and What formed them.

Every field is optional, free text in the author's words (D1, D3); the only fixed sets are an
entry's area and who knows about it, so the sheet and the prompts can group and filter. Unknown
keys in an entry are dropped, not stored.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: Body and mind areas (P4), in the order the sheet shows them.
AREAS = ("moving", "senses", "communicating", "health", "neurodivergence", "mental_health", "other")
Area = Literal["moving", "senses", "communicating", "health", "neurodivergence", "mental_health", "other"]
#: Who in the story knows: everyone, some (named in known_to and known_note), or only them.
Known = Literal["everyone", "some", "only_them"]


def _id() -> str:
    return str(uuid.uuid4())


class _Entry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=_id)
    impact: str = ""
    page: str = ""
    known_to: list[str] = []
    known_note: str = ""
    #: The scene where the reader learns it.
    revealed_in: str | None = None
    #: False keeps the entry out of every prompt (a Studio-only switch on the sheet).
    assistant: bool = True


class Facet(_Entry):
    """One Body and mind entry: a disability, a condition, a way of being, in the author's words."""

    area: Area
    name: str = ""
    since: str = ""
    days: str = ""
    understood: str = ""
    known: Known = "everyone"
    #: Compendium entries that inform it.
    research: list[str] = []


class Formative(_Entry):
    """One formative experience: what happened, what it did to them, how it shows."""

    title: str = ""
    when: str = ""
    what: str = ""
    #: The experience behind the arc (the wound).
    wound: bool = False
    #: Content notes, for the author only: never exported, never sent to a model.
    notes: list[str] = []
    known: Known = "only_them"


#: The plain fields, column by column (P1, P2, P5): one line each, then paragraphs.
SHORT_FIELDS = ("gender", "presentation", "sex", "age", "orientation", "languages")
TEXT_FIELDS = (
    "heritage",
    "faith",
    "family",
    "circumstances",
    "thinking",
    "need",
    "lie",
    "stakes",
    "sore_spots",
    "takes_personally",
    "shows_hurt",
    "copes",
    "holds_on",
)
FIELDS = SHORT_FIELDS + TEXT_FIELDS


class WhoAreTheyOut(BaseModel):
    """The fields on a character as read: empty when never written."""

    gender: str = ""
    presentation: str = ""
    sex: str = ""
    age: str = ""
    orientation: str = ""
    languages: str = ""
    heritage: str = ""
    faith: str = ""
    family: str = ""
    circumstances: str = ""
    thinking: str = ""
    need: str = ""
    lie: str = ""
    stakes: str = ""
    sore_spots: str = ""
    takes_personally: str = ""
    shows_hurt: str = ""
    copes: str = ""
    holds_on: str = ""
    facets: list[Facet] = []
    formative: list[Formative] = []


class WhoAreTheyPatch(BaseModel):
    """The same fields in an update: only what is sent changes."""

    gender: str | None = None
    presentation: str | None = None
    sex: str | None = None
    age: str | None = None
    orientation: str | None = None
    languages: str | None = None
    heritage: str | None = None
    faith: str | None = None
    family: str | None = None
    circumstances: str | None = None
    thinking: str | None = None
    need: str | None = None
    lie: str | None = None
    stakes: str | None = None
    sore_spots: str | None = None
    takes_personally: str | None = None
    shows_hurt: str | None = None
    copes: str | None = None
    holds_on: str | None = None
    facets: list[Facet] | None = None
    formative: list[Formative] | None = None
