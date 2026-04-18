"""
Pydantic schemas for the Editorial Pass feature.

The editorial pass runs 5 analyses over a story scope and stores the result
as a structured ActivityLog entry (event_type="editorial_pass").
"""

from typing import Literal
from pydantic import BaseModel


# ── Shared ─────────────────────────────────────────────────────────────────────

class EditorialNote(BaseModel):
    """A single anchored editorial note to be inserted as an inline note."""
    anchor: str          # Exact text passage to highlight
    note: str            # The editorial comment
    category: str        # "fresh-eyes" | "priority" | "voice" | "intent-gap" | "marginal"
    section_title: str = ""  # Which scene/chapter this belongs to


# ── Fresh Eyes + Reader Experience ────────────────────────────────────────────

class FreshEyesQuestion(BaseModel):
    section_title: str
    question: str        # "A reader would wonder: why did X happen before Y?"
    context: str = ""    # What in the text triggered this question
    anchor: str = ""     # Optional: passage that triggered the question


class FreshEyesResponse(BaseModel):
    questions: list[FreshEyesQuestion] = []
    summary: str = ""


# ── Tiered Priorities ─────────────────────────────────────────────────────────

class RevisionPriority(BaseModel):
    rank: int
    section_title: str
    issue: str           # Brief description of the issue
    suggestion: str      # Specific actionable suggestion
    impact: Literal["high", "medium", "low"] = "medium"
    anchor: str = ""     # Optional: passage that triggered this


class PrioritiesResponse(BaseModel):
    priorities: list[RevisionPriority] = []
    overall_note: str = ""


# ── Intent vs Execution Gap ───────────────────────────────────────────────────

class IntentGap(BaseModel):
    section_title: str
    stated_intent: str   # What the author said this section should do
    execution: str       # What the prose actually does
    gap: str             # Where they diverge
    suggestion: str
    anchor: str = ""


class IntentGapResponse(BaseModel):
    gaps: list[IntentGap] = []
    sections_aligned: list[str] = []   # Section titles where intent matches well
    summary: str = ""


# ── Voice Characterization ────────────────────────────────────────────────────

class VoiceSection(BaseModel):
    section_title: str
    observation: str     # What the voice sounds like here
    anchor: str = ""     # Representative passage
    deviation: bool = False  # True if this section drifts from the overall voice


class VoiceResponse(BaseModel):
    overall_voice: str = ""   # "Your prose voice is X — clipped, sardonic, present-tense"
    sections: list[VoiceSection] = []
    consistency_rating: Literal["consistent", "minor-drift", "significant-drift"] = "consistent"
    summary: str = ""


# ── Marginal Commentary ───────────────────────────────────────────────────────

class MarginalNote(BaseModel):
    section_title: str
    anchor: str          # The specific passage being commented on
    comment: str         # The marginal note text
    type: Literal["strength", "concern", "suggestion"] = "suggestion"


class MarginalNotesResponse(BaseModel):
    notes: list[MarginalNote] = []


# ── Request ───────────────────────────────────────────────────────────────────

class EditorialRunRequest(BaseModel):
    context_level: Literal["full", "summaries", "section"]
    scope_type: Literal["story", "chapters", "scenes"]
    scope_ids: list[str] = []   # Empty means whole story


# ── Report ────────────────────────────────────────────────────────────────────

class EditorialStats(BaseModel):
    fresh_eyes_count: int = 0
    priorities_count: int = 0
    intent_gaps_count: int = 0
    voice_notes_count: int = 0
    marginal_notes_count: int = 0


class EditorialReportMetadata(BaseModel):
    feature: str = "editorial-pass"
    context_level: Literal["full", "summaries", "section"]
    scope_type: Literal["story", "chapters", "scenes"]
    scope_ids: list[str] = []
    stats: EditorialStats = EditorialStats()
    fresh_eyes: FreshEyesResponse = FreshEyesResponse()
    priorities: PrioritiesResponse = PrioritiesResponse()
    intent_gaps: IntentGapResponse = IntentGapResponse()
    voice: VoiceResponse = VoiceResponse()
    marginal_notes: MarginalNotesResponse = MarginalNotesResponse()
    error: str | None = None
