"""
Pydantic schemas for structured AI responses.

Used by AIGateway.generate_structured() to validate JSON responses from Ollama.
Each schema corresponds to a one-shot AI feature that returns typed, renderable data.
"""

from pydantic import BaseModel


# ── Scene Planner ─────────────────────────────────────────────────────────────

class CharacterFeatureSuggestion(BaseModel):
    name: str
    reason: str = ""


class ThreadAdvanceSuggestion(BaseModel):
    name: str
    how: str = ""


class ScenePlanResponse(BaseModel):
    synopsis: str = ""
    purpose: str = ""
    entry_state: str = ""
    exit_state: str = ""
    key_events: list[str] = []
    characters_to_feature: list[CharacterFeatureSuggestion] = []
    threads_to_advance: list[ThreadAdvanceSuggestion] = []


# ── Economy Analysis ──────────────────────────────────────────────────────────

class AnalysisSection(BaseModel):
    summary: str = ""
    details: list[str] = []


class EconomyAnalysisResponse(BaseModel):
    thread_balance: AnalysisSection = AnalysisSection()
    scene_economy: AnalysisSection = AnalysisSection()
    try_fail_cycles: AnalysisSection = AnalysisSection()
    recommendations: list[str] = []


# ── Attribute Generation ──────────────────────────────────────────────────────

class AttributeSuggestion(BaseModel):
    text: str
    rationale: str = ""


class AttributeSuggestionsResponse(BaseModel):
    suggestions: list[AttributeSuggestion] = []


# ── Relationship Suggestions ──────────────────────────────────────────────────

class RelationshipSuggestion(BaseModel):
    character_a: str
    character_b: str
    relationship_type: str
    description: str


class RelationshipSuggestionsResponse(BaseModel):
    suggestions: list[RelationshipSuggestion] = []


# ── World Building AI ─────────────────────────────────────────────────────────

class LocationExistenceResponse(BaseModel):
    built_environment: list[str] = []
    natural_environment: list[str] = []
    cultural_presence: list[str] = []
    questions: list[str] = []


class CultureElementSuggestionsResponse(BaseModel):
    naming_directions: list[str] = []
    ritual_directions: list[str] = []
    aesthetic_directions: list[str] = []
    questions: list[str] = []


class LocationElementSuggestionsResponse(BaseModel):
    creature_directions: list[str] = []
    flora_directions: list[str] = []
    naming_directions: list[str] = []
    questions: list[str] = []


class HistoricalImplicationsResponse(BaseModel):
    physical_remnants: list[str] = []
    cultural_legacy: list[str] = []
    political_effects: list[str] = []
    questions: list[str] = []


class SystemAnalysisResponse(BaseModel):
    edge_cases: list[str] = []
    story_implications: list[str] = []
    consistency_questions: list[str] = []
    questions: list[str] = []


class CalendarSuggestionsResponse(BaseModel):
    festivals: list[str] = []
    seasonal_events: list[str] = []
    historical_observances: list[str] = []
    questions: list[str] = []


class TravelAnalysisResponse(BaseModel):
    journey_considerations: list[str] = []
    hazards_and_challenges: list[str] = []
    narrative_possibilities: list[str] = []
    questions: list[str] = []


# ── Twist Analysis ────────────────────────────────────────────────────────────

class ClueAssessment(BaseModel):
    clue_id: str = ""                   # ID from the twist's clues array
    clue_text: str = ""
    assessment: str = ""               # found | missing | needs-work
    notes: str = ""
    suggested_scene_id: str = ""       # Suggested scene to link (for unlinked/missing clues)
    suggested_scene_title: str = ""    # Human-readable title of suggested scene


class ClueVerificationSection(BaseModel):
    summary: str = ""
    details: list[ClueAssessment] = []


class DistributionSection(BaseModel):
    summary: str = ""
    gaps: list[str] = []
    truth_count: int = 0
    misdirection_count: int = 0


class RevealSection(BaseModel):
    summary: str = ""
    unforeshadowed_elements: list[str] = []
    strengths: list[str] = []


class MisdirectionSection(BaseModel):
    summary: str = ""
    suggestions: list[str] = []


class TwistAnalysisResponse(BaseModel):
    clue_verification: ClueVerificationSection = ClueVerificationSection()
    distribution: DistributionSection = DistributionSection()
    reveal: RevealSection = RevealSection()
    misdirection_strength: MisdirectionSection = MisdirectionSection()
    overall_rating: str = "fair"   # needs_work | fair | good | excellent
    suggestions: list[str] = []


# ── Thread Analysis ──────────────────────────────────────────────────────────

class ThreadMomentDiscovery(BaseModel):
    scene_id: str = ""
    scene_title: str = ""
    moment_type: str = ""   # inciting | complication | turning_point | climax | resolution
    description: str = ""
    suggested_cycle_link: bool = False   # Should this become a try/fail cycle entry?


class ThreadAnalysisResponse(BaseModel):
    progression: AnalysisSection = AnalysisSection()   # MICE lifecycle position, current state
    moment_discoveries: list[ThreadMomentDiscovery] = []
    quality: AnalysisSection = AnalysisSection()       # Pacing, try/fail depth, resolution setup
    unlinked_cycles: list[str] = []                    # Cycles with no scene assignment
    suggestions: list[str] = []
    overall_rating: str = "fair"   # needs_work | fair | good | excellent


# ── Arc Analysis ──────────────────────────────────────────────────────────────

class ArcMomentDiscovery(BaseModel):
    scene_id: str = ""
    scene_title: str = ""
    arc_significance: str = ""          # What happens to the character here
    suggested_milestone_link: str = ""  # Milestone text this might fulfill (empty if none)


class ArcAnalysisResponse(BaseModel):
    trajectory: AnalysisSection = AnalysisSection()       # Current position, growth direction
    moment_discoveries: list[ArcMomentDiscovery] = []
    drift_analysis: AnalysisSection = AnalysisSection()   # Planned vs actual arc
    health: AnalysisSection = AnalysisSection()           # Pacing issues, missing beats
    unlinked_milestones: list[str] = []
    suggestions: list[str] = []
    overall_rating: str = "fair"   # needs_work | fair | good | excellent


# ── Dialogue Attribution ──────────────────────────────────────────────────────

class DialogueAttributionSuggestion(BaseModel):
    quote_text: str
    suggested_speaker: str
    confidence: float = 0.5   # 0–1
    reasoning: str = ""


class DialogueAttributionResponse(BaseModel):
    suggestions: list[DialogueAttributionSuggestion] = []


# ── Essential Questions Analysis ─────────────────────────────────────────────

class QuestionAssessment(BaseModel):
    question: str = ""
    status: str = "unclear"               # clear | partial | unclear
    evidence: str = ""                    # What data supports this assessment
    recommendation: str = ""             # What to add/clarify if not clear


class EssentialQuestionsResponse(BaseModel):
    protagonist: QuestionAssessment = QuestionAssessment()
    want: QuestionAssessment = QuestionAssessment()
    why: QuestionAssessment = QuestionAssessment()
    obstacle: QuestionAssessment = QuestionAssessment()
    stakes: QuestionAssessment = QuestionAssessment()
    change: QuestionAssessment = QuestionAssessment()
    overall_clarity: str = "fair"         # needs_work | fair | good | excellent
    summary: str = ""


# ── Structured result wrapper ─────────────────────────────────────────────────

class StructuredResult(BaseModel):
    """
    Wrapper returned by AIGateway.generate_structured().

    success=True  → data is valid; use data for rendering
    success=False → fallback; use raw_data (partial) or raw_text (markdown)
    """
    success: bool
    data: dict | None = None          # Validated and serialized model dict
    raw_data: dict | None = None      # Parsed JSON that failed schema validation
    raw_text: str = ""                # Raw text response (fallback)
    tokens_in: int | None = None
    tokens_out: int | None = None
    model: str = ""
