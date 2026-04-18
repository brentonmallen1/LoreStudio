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


# ── Pronoun Identification (LLM locates, service substitutes) ────────────────

class PronounInstance(BaseModel):
    exact_text: str       # 6–10 word context phrase from the text
    target_word: str      # the specific pronoun within that phrase
    word_type: str = ""   # subject | object | possessive_det | possessive_pron | reflexive | gendered_noun


class PronounIdentificationResponse(BaseModel):
    instances: list[PronounInstance] = []


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


# ── Show Don't Tell Analysis ──────────────────────────────────────────────────

class ShowDontTellInstance(BaseModel):
    passage: str = ""              # Exact quoted text flagged
    severity: str = "moderate"     # strong | moderate | subtle
    issue_type: str = ""           # emotion | state | quality | exposition
    explanation: str = ""          # Why this is telling
    suggestion: str = ""           # A "showing" alternative


class ShowDontTellAnalysisResponse(BaseModel):
    instances: list[ShowDontTellInstance] = []
    summary: str = ""
    overall_rating: str = "fair"   # needs_work | fair | good | excellent
    strengths: list[str] = []


# ── Target Audience Adherence ─────────────────────────────────────────────────

class AudienceIssue(BaseModel):
    passage: str = ""
    issue_type: str = ""           # vocabulary | content | theme | pacing | tone
    severity: str = "moderate"     # critical | moderate | minor
    explanation: str = ""
    suggestion: str = ""


class AudienceAdherenceResponse(BaseModel):
    target_audience: str = ""
    issues: list[AudienceIssue] = []
    vocabulary_assessment: str = ""
    content_assessment: str = ""
    theme_assessment: str = ""
    overall_fit: str = "good"      # poor | fair | good | excellent
    summary: str = ""


# ── Pacing Analysis ───────────────────────────────────────────────────────────

class PacingAnalysisResponse(BaseModel):
    act_balance: AnalysisSection = AnalysisSection()       # Word distribution across acts/sections
    tension_curve: AnalysisSection = AnalysisSection()     # Rising/falling tension patterns
    slow_spots: list[str] = []                             # Scene titles or passages that drag
    pacing_strengths: list[str] = []                       # What's working well
    recommendations: list[str] = []
    overall_rating: str = "fair"   # needs_work | fair | good | excellent


# ── Continuity Check ──────────────────────────────────────────────────────────

class ContinuityIssue(BaseModel):
    description: str = ""          # What the inconsistency is
    severity: str = "moderate"     # critical | moderate | minor
    scene_references: list[str] = []   # Scene titles involved
    explanation: str = ""
    suggestion: str = ""           # What to consider doing about it


class ContinuityCheckResponse(BaseModel):
    issues: list[ContinuityIssue] = []
    timeline_notes: list[str] = []    # General timeline observations
    character_notes: list[str] = []   # Character knowledge/state observations
    summary: str = ""
    overall_rating: str = "fair"   # needs_work | fair | good | excellent


# ── Theme Tracker ─────────────────────────────────────────────────────────────

class ThemeEntry(BaseModel):
    name: str = ""
    description: str = ""
    scenes: list[str] = []        # Scene titles where this theme appears
    development: str = ""         # How the theme develops across the story
    strength: str = "emerging"    # emerging | present | well_developed


class ThemeTrackerResponse(BaseModel):
    themes: list[ThemeEntry] = []
    motifs: list[str] = []        # Recurring images, symbols, phrases
    thematic_arc: str = ""        # Overall thematic journey summary
    gaps: list[str] = []          # Thematic opportunities not yet developed
    recommendations: list[str] = []


# ── Plot Hole Detection ───────────────────────────────────────────────────────

class PlotHole(BaseModel):
    description: str = ""
    severity: str = "moderate"     # critical | moderate | minor
    scene_references: list[str] = []
    explanation: str = ""
    suggestion: str = ""           # Possible resolution to consider


class PlotHoleDetectionResponse(BaseModel):
    holes: list[PlotHole] = []
    logic_gaps: list[str] = []     # Minor logical issues, less than full holes
    unanswered_questions: list[str] = []  # Things raised but not addressed
    summary: str = ""
    overall_rating: str = "fair"   # needs_work | fair | good | excellent


# ── First-Pass Editor ────────────────────────────────────────────────────────

class IntentGap(BaseModel):
    area: str = ""              # goal_alignment | arc_progress | tone | setup | pacing
    finding: str = ""           # What the analysis found
    severity: str = "moderate"  # critical | moderate | minor
    scene_references: list[str] = []
    suggestion: str = ""        # What to consider


class FirstPassAnalysisResponse(BaseModel):
    goal_alignment: AnalysisSection = AnalysisSection()   # Are stated story goals being met?
    arc_progress: AnalysisSection = AnalysisSection()     # Are character arcs on track?
    tone_consistency: AnalysisSection = AnalysisSection() # Is tone consistent with stated intent?
    missed_setups: list[str] = []                         # Foreshadowing/setup opportunities not taken
    gaps: list[IntentGap] = []                            # Specific intent-vs-prose mismatches
    strengths: list[str] = []                             # What is working well relative to intent
    recommendations: list[str] = []
    overall_rating: str = "fair"  # needs_work | fair | good | excellent


# ── Comp Titles ───────────────────────────────────────────────────────────────

class CompTitle(BaseModel):
    title: str = ""
    author: str = ""
    year: str = ""
    reasoning: str = ""
    similarity_aspects: list[str] = []


class CompTitlesResponse(BaseModel):
    suggestions: list[CompTitle] = []
    positioning_note: str = ""   # Brief note on how these comps position the work


# ── Outline Extraction ────────────────────────────────────────────────────────

class ExtractedOutlineItem(BaseModel):
    text: str = ""
    beat_type: str = ""          # plot | character | theme | setting | ""
    suggested_scene_id: str = "" # Scene this beat came from (if identifiable)
    suggested_scene_title: str = ""
    confidence: float = 0.8
    reasoning: str = ""          # Why the model identified this as a beat


class ExtractedOutlineResponse(BaseModel):
    items: list[ExtractedOutlineItem] = []
    suggested_name: str = ""     # Proposed outline tab name


# ── Outline Alignment ─────────────────────────────────────────────────────────

class OutlineAlignmentItem(BaseModel):
    outline_text: str = ""
    status: str = "missing"      # covered | partial | missing
    evidence: str = ""           # What in the manuscript supports/doesn't support this beat
    scene_references: list[str] = []


class OutlineAlignmentResponse(BaseModel):
    covered_beats: list[OutlineAlignmentItem] = []
    missing_beats: list[OutlineAlignmentItem] = []
    unplanned_content: list[str] = []   # Manuscript content not in the outline
    divergences: list[str] = []         # Where prose went a different direction
    recommendations: list[str] = []
    coverage_score: int = 0             # 0-100 percent of outline beats covered


# ── Cliche Analysis ──────────────────────────────────────────────────────────

class ClicheInstance(BaseModel):
    passage: str = ""              # Exact quoted text containing the cliche
    cliche_type: str = ""          # phrase | trope | character_type | plot_device | description
    scene_title: str = ""
    scene_id: str = ""             # For navigation
    explanation: str = ""          # Why it's a cliche
    severity: str = "moderate"     # strong | moderate | subtle
    intentional_use_case: str = "" # When using it might be valid


class ClicheCategory(BaseModel):
    name: str = ""
    count: int = 0
    instances: list[ClicheInstance] = []


class ClicheAnalysisResponse(BaseModel):
    categories: list[ClicheCategory] = []
    total_count: int = 0
    density_note: str = ""
    genre_context: str = ""
    summary: str = ""
    overall_rating: str = "fair"   # needs_work | fair | good | excellent
    strengths: list[str] = []


# ── Discovery Questions ───────────────────────────────────────────────────────

class DiscoveryQuestion(BaseModel):
    question: str = ""              # The thought-provoking question
    context_area: str = ""          # backstory | motivation | sensory | conflict | relationship | worldbuilding | arc | stakes | culture | economy | subtext | purpose
    why_this_matters: str = ""      # 1-2 sentence explanation of why exploring this helps


class DiscoveryQuestionsResponse(BaseModel):
    questions: list[DiscoveryQuestion] = []   # 3-5 questions
    focus_area: str = ""                       # character | location | scene | story
    entity_name: str = ""                      # Name of what was analyzed
    observation: str = ""                      # Brief note on what seems underdeveloped


# ── Character Dimensionality ─────────────────────────────────────────────────

class CharacterDimensionEntry(BaseModel):
    character_id: str = ""
    character_name: str = ""
    role: str = ""                   # protagonist | antagonist | supporting | minor
    dimension_score: str = "flat"    # flat | developing | dimensional | complex
    strengths: list[str] = []        # What makes this character feel real
    gaps: list[str] = []             # Where the character feels thin or undefined
    contradictions: str = ""         # Internal tensions that add (or lack) depth
    relationship_depth: str = ""     # How well-developed their relationships are
    recommendations: list[str] = []  # Specific, actionable suggestions


class CharacterDimensionalityResponse(BaseModel):
    characters: list[CharacterDimensionEntry] = []
    cast_balance: str = ""      # Are characters developed appropriately for their roles?
    ensemble_dynamics: str = "" # How well do characters play off each other?
    summary: str = ""
    overall_rating: str = "fair"  # needs_work | fair | good | excellent


# ── Voice Fidelity ────────────────────────────────────────────────────────────

class VoiceFidelityFinding(BaseModel):
    dialogue_excerpt: str = ""
    # etymology_mismatch, vocabulary_mismatch, formality_drift,
    # education_inconsistency, manner_conflict, authentic
    issue_type: str = ""
    severity: str = "info"   # issue | warning | info
    explanation: str = ""
    attribute_context: str = ""   # Which attribute(s) are relevant
    suggestion: str = ""


class VoiceFidelityResponse(BaseModel):
    character_name: str = ""
    attribute_summary: str = ""      # One-sentence summary of relevant attributes
    findings: list[VoiceFidelityFinding] = []
    authentic_examples: list[str] = []   # Dialogue excerpts that ring true
    overall_fidelity: str = "good"       # excellent | good | fair | needs_work
    summary: str = ""
    recommendations: list[str] = []


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
