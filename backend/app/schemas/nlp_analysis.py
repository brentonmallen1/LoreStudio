"""
Pydantic schemas for spaCy-based NLP prose analysis.

These schemas are returned by the /analyze/prose-nlp and /analyze/entity-suggestions
endpoints. No LLM is involved — analysis is deterministic and local.
"""

from __future__ import annotations

from pydantic import BaseModel


# ── Shared finding type ───────────────────────────────────────────────────────

class PassageFinding(BaseModel):
    passage: str              # Exact sentence or phrase from the scene
    char_offset: int = 0      # Character offset in plain text (for navigation)
    severity: str = "info"    # info | warning | issue
    explanation: str = ""
    suggestion: str = ""


# ── Passive voice ─────────────────────────────────────────────────────────────

class PassiveVoiceResult(BaseModel):
    findings: list[PassageFinding] = []
    sentence_count: int = 0
    passive_count: int = 0
    percentage: float = 0.0   # passive_count / sentence_count * 100


# ── Adverb overuse ────────────────────────────────────────────────────────────

class AdverbResult(BaseModel):
    findings: list[PassageFinding] = []
    word_count: int = 0
    adverb_count: int = 0
    percentage: float = 0.0   # adverb_count / word_count * 100
    threshold: float = 5.0    # % at which to flag as excessive


# ── Said-bookism detection ────────────────────────────────────────────────────

class SaidBookismResult(BaseModel):
    findings: list[PassageFinding] = []
    total_attributions: int = 0   # Total dialogue attribution verbs found
    bookism_count: int = 0        # Attributions that aren't said/asked


# ── Repeated word proximity ───────────────────────────────────────────────────

class RepeatedWordResult(BaseModel):
    findings: list[PassageFinding] = []
    window_chars: int = 200       # Character window used for detection


# ── Sentence variety ──────────────────────────────────────────────────────────

class SentenceLengthBucket(BaseModel):
    label: str          # e.g. "1–5", "6–10", "11–20", "21–35", "36+"
    count: int


class SentenceVarietyResult(BaseModel):
    sentence_count: int = 0
    mean_length: float = 0.0      # Mean words per sentence
    std_dev: float = 0.0          # Std dev of sentence lengths
    min_length: int = 0
    max_length: int = 0
    histogram: list[SentenceLengthBucket] = []
    assessment: str = ""          # "monotonous" | "varied" | "erratic" | "too_short"


# ── NER entity suggestions ────────────────────────────────────────────────────

class EntitySuggestion(BaseModel):
    text: str                # Entity text as found in prose
    label: str               # PERSON | ORG | GPE | LOC
    scene_count: int = 1     # Number of scenes it appears in
    occurrences: int = 1     # Total occurrences across scenes
    scene_ids: list[str] = []
    scene_titles: list[str] = []


class EntitySuggestionsResponse(BaseModel):
    character_suggestions: list[EntitySuggestion] = []   # PERSON entities
    location_suggestions: list[EntitySuggestion] = []    # GPE + LOC entities


# ── Per-scene analysis result ─────────────────────────────────────────────────

class SceneNLPAnalysis(BaseModel):
    scene_id: str
    scene_title: str
    word_count: int = 0
    passive_voice: PassiveVoiceResult | None = None
    adverb_overuse: AdverbResult | None = None
    said_bookisms: SaidBookismResult | None = None
    repeated_words: RepeatedWordResult | None = None
    sentence_variety: SentenceVarietyResult | None = None


class ProseNLPResponse(BaseModel):
    scenes: list[SceneNLPAnalysis] = []
    checks_run: list[str] = []   # Which checks were included in this run


# ── Editorial Consistency (tense + POV) ──────────────────────────────────────

class TenseShift(BaseModel):
    sentence: str
    char_offset: int = 0
    dominant_tense: str = ""    # "past" | "present"
    detected_tense: str = ""    # tense detected in this sentence
    severity: str = "warning"   # warning | info


class TenseConsistencyResult(BaseModel):
    findings: list[TenseShift] = []
    dominant_tense: str = ""        # "past" | "present" | "mixed" | ""
    past_sentence_count: int = 0
    present_sentence_count: int = 0
    shift_count: int = 0


class POVDriftFinding(BaseModel):
    sentence: str
    char_offset: int = 0
    subjects: list[str] = []        # Named subjects of perspective verbs here
    severity: str = "warning"
    explanation: str = ""


class POVDriftResult(BaseModel):
    findings: list[POVDriftFinding] = []
    dominant_subject: str = ""          # Most common perspective-verb subject
    perspective_subjects: list[str] = []  # All subjects found using perspective verbs


class SceneEditorialAnalysis(BaseModel):
    scene_id: str
    scene_title: str
    word_count: int = 0
    tense_consistency: TenseConsistencyResult | None = None
    pov_drift: POVDriftResult | None = None


class EditorialConsistencyResponse(BaseModel):
    scenes: list[SceneEditorialAnalysis] = []
    checks_run: list[str] = []
    total_tense_shifts: int = 0
    total_pov_flags: int = 0
