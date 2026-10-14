"""What the wizard shows of a Novelcrafter export, and what the author chose (doc 28)."""

from typing import Literal

from pydantic import BaseModel

#: Where a codex entry goes. "facet" folds it into a character's field; "merge" folds it into
#: another entry's row; "later" waits in Proposals › Imported; "skip" leaves it out (it is still
#: in the import record and the original file).
EntryTarget = Literal[
    "character",
    "location",
    "thread",
    "trope",
    "theme",
    "world_system",
    "culture",
    "historical_event",
    "compendium",
    "note",
    "facet",
    "merge",
    "later",
    "skip",
]
#: A character field a facet folds into, or "note" for a note about the character.
FacetField = Literal["appearance", "speech_patterns", "thinking", "background", "personality", "note"]
SnippetTarget = Literal["note", "compendium", "logline", "later", "skip"]


class NcEntry(BaseModel):
    id: str
    origin: str
    type: str
    name: str
    aliases: list[str]
    tags: list[str]
    excerpt: str
    has_notes: bool
    has_thumbnail: bool
    urls: int
    target: EntryTarget
    #: For a facet: the entry it folds into and the field.
    facet_of: str | None = None
    facet_field: FacetField | None = None
    #: An entry this one looks like: the same name, or a name the other goes by.
    clash_with: str | None = None
    clash_text: str = ""


class NcSnippet(BaseModel):
    id: str
    origin: str
    title: str
    excerpt: str
    target: SnippetTarget


class NcChat(BaseModel):
    id: str
    origin: str
    title: str
    date: str
    turns: int


class LeftOut(BaseModel):
    """Something in the file with no place in LoreStudio, or a note that a kind of thing was
    never set (``count`` 0): either way the author reads what happens to it."""

    what: str
    why: str
    count: int = 0
    examples: list[str] = []


class NovelcrafterPreview(BaseModel):
    entries: list[NcEntry]
    snippets: list[NcSnippet]
    chats: list[NcChat]
    #: In the file, with nowhere to go: kept in the import record.
    no_place: list[LeftOut]
    #: Kinds of thing the file could have held but did not: nothing to lose.
    nothing_set: list[str]
    #: What Novelcrafter keeps that its export leaves out.
    not_in_file: list[str]
    author: str | None = None
    #: The manuscript reads like a screenplay (sluglines, cues): offer to import it as one.
    looks_like_screenplay: bool = False


class NcEntryChoice(BaseModel):
    target: EntryTarget
    facet_of: str | None = None
    facet_field: FacetField | None = None
    #: For "merge": the entry it folds into.
    merge_into: str | None = None


class NovelcrafterChoices(BaseModel):
    """What the author chose in What comes over; anything not listed keeps its default."""

    entries: dict[str, NcEntryChoice] = {}
    snippets: dict[str, SnippetTarget] = {}
    chats: bool = True
    screenplay: bool = False
