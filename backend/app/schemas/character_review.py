"""The review step (doc 20 P3): a character's new pronouns or name, followed through the prose."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .character import CharacterOut


class ReviewRequest(BaseModel):
    #: The pronouns being left, and the ones taken; both empty for a review for slips.
    pronouns_from: str = ""
    pronouns_to: str = ""
    name_from: str = ""
    name_to: str = ""
    #: A review for slips: pronouns of any other set that follow the character's name.
    slips: bool = False


class ReviewEdit(BaseModel):
    start: int
    end: int
    text: str
    #: What is there now, checked again before the edit is made.
    was: str


class ReviewItem(BaseModel):
    id: str
    node_id: str
    para: int
    kind: Literal["pronoun", "gendered", "name"]
    sure: bool
    sent_start: int
    sent_end: int
    before: str
    after: str
    edits: list[ReviewEdit]
    note: str = ""


class ReviewScene(BaseModel):
    node_id: str
    title: str
    updated_at: str


class ReviewOut(BaseModel):
    items: list[ReviewItem]
    scenes: list[ReviewScene]
    #: Why a pronoun set cannot be followed ("any pronouns"), when it cannot.
    unsupported: str = ""


class ApplyItem(BaseModel):
    node_id: str
    para: int
    sent_start: int
    sent_end: int
    before: str
    edits: list[ReviewEdit] = []
    #: The author's own sentence, in place of the proposed edits.
    hand: str | None = None


class ApplyRequest(BaseModel):
    pronouns: str | None = None
    name: str | None = None
    items: list[ApplyItem] = []
    #: Each scene's updated_at when the review was read; one edited since is left alone.
    seen: dict[str, str] = {}


class ApplyOut(BaseModel):
    character: CharacterOut
    applied: int
    #: Scenes edited since the review was read, left as they are.
    skipped: list[str]
    #: Sentences whose words now run across formatting, so they were not changed.
    not_placed: int


class CarefulRequest(ReviewRequest):
    #: The scenes to ask about: the ones with unsure sentences.
    node_ids: list[str] = []


class CarefulJudgement(BaseModel):
    item_id: str
    #: theirs: every pronoun in the sentence is theirs; partly: some; not: none.
    verdict: Literal["theirs", "partly", "not"]


class CarefulOut(BaseModel):
    judged: list[CarefulJudgement]
