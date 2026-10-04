"""Findings: one feed for everything that needs the author's eye (doc 12 P3).

A finding is computed, not stored. Local checks run over the prose, data checks over the
story's own records, and Assistant findings are read from the runs the Chronicle already
keeps. Its id is a fingerprint, stable from one read to the next, so a dismissal can name it.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

FindingKind = Literal["prose", "continuity", "structure", "cast", "meaning"]
Severity = Literal["high", "mid", "low"]
Source = Literal["local", "ai", "data"]
#: What the row's verb does. ``open_sheet`` with no anchor opens Story Identity.
Action = Literal["open_scene", "open_sheet", "open_chapter", "ask", "fix"]


class FindingAnchor(BaseModel):
    """Where a finding lives. At most one id is usually set; a scene finding about a
    character may carry both."""

    node_id: str | None = None
    character_id: str | None = None
    location_id: str | None = None
    thread_id: str | None = None
    twist_id: str | None = None
    #: A series element the finding is about: the same finding in every book that has it.
    series_element_id: str | None = None


class FindingFix(BaseModel):
    """A fix the app can make for the author, on their word: a misspelt name, or (``series``)
    this book's value of an enduring field made the value in every book of the series."""

    kind: Literal["rename", "series"] = "rename"
    old: str
    new: str
    #: ``series`` only: the field, and the element it is a field of.
    field: str | None = None
    element_id: str | None = None


class Finding(BaseModel):
    id: str
    kind: FindingKind
    severity: Severity
    source: Source
    #: Which check said so: "name_drift", "absent_character", "pacing-analysis", ...
    check: str
    text: str
    #: The passage or fact it rests on.
    evidence: str = ""
    #: A question or direction, never a rewrite.
    suggestion: str = ""
    #: Human words for the anchor: the scene title, the character's name.
    where: str = ""
    anchor: FindingAnchor = FindingAnchor()
    action: Action = "open_scene"
    fix: FindingFix | None = None
    #: The Chronicle entry an Assistant or local-run finding came from.
    run_id: str | None = None
    feature: str | None = None
    created_at: datetime | None = None


class FindingsSizing(BaseModel):
    """Which checks make sense for this story's shape (doc 12: no chapter checks without
    chapters, no word-target checks without a target)."""

    has_chapters: bool
    has_target: bool
    written_scenes: int


class FindingsOut(BaseModel):
    findings: list[Finding]
    counts_by_kind: dict[str, int]
    open_count: int
    dismissed_count: int
    last_local_run: datetime | None = None
    last_ai_run_by_feature: dict[str, datetime] = {}
    sizing: FindingsSizing


class FindingsCount(BaseModel):
    count: int


class FixResult(BaseModel):
    #: The scene a rename rewrote; None for a series fix, which writes the books' sheets.
    node_id: str | None
    replaced: int
