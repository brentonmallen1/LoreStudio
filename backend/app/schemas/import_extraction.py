"""
Schemas for entity extraction during manuscript import.

Two-stage extraction:
  Stage 1 (NLP): spaCy NER → character and location name candidates
  Stage 2 (AI):  Ollama structured output → attributes for each candidate
"""
from typing import Literal, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class ExtractionOptions(BaseModel):
    characters_nlp: bool = True
    locations_nlp: bool = True
    characters_ai: bool = False
    locations_ai: bool = False
    relationships_ai: bool = False


# ---------------------------------------------------------------------------
# AI structured output schemas (used with generate_structured)
# ---------------------------------------------------------------------------

class ExtractedCharacter(BaseModel):
    role: str = ""
    personality: str = ""
    motivation: str = ""
    appearance: str = ""
    background: str = ""
    confidence: float = 0.5


class ExtractedLocation(BaseModel):
    location_type: str = ""
    description: str = ""
    atmosphere: str = ""
    significance: str = ""
    confidence: float = 0.5


class ExtractedRelationship(BaseModel):
    relationship_type: str = ""
    description: str = ""
    role_influence: str = ""
    confidence: float = 0.5


# ---------------------------------------------------------------------------
# Candidate — a single entity found during extraction
# ---------------------------------------------------------------------------

class ExtractionCandidate(BaseModel):
    id: str
    name: str
    entity_type: Literal["character", "location", "relationship"]
    source: Literal["nlp", "ai"]
    occurrences: int
    scene_count: int
    confidence: float
    # Scene/node ids where this entity was found (used internally for AI excerpts)
    scene_ids: list[str] = []
    # For relationship candidates, the two character names
    char_a_name: Optional[str] = None
    char_b_name: Optional[str] = None
    # Populated by AI stage (optional)
    extracted_character: Optional[ExtractedCharacter] = None
    extracted_location: Optional[ExtractedLocation] = None
    extracted_relationship: Optional[ExtractedRelationship] = None


# ---------------------------------------------------------------------------
# Preview — returned from /extract-preview
# ---------------------------------------------------------------------------

class ExtractionPreview(BaseModel):
    candidates: list[ExtractionCandidate]
    ai_available: bool
    nlp_elapsed_ms: int
    ai_elapsed_ms: Optional[int] = None


# ---------------------------------------------------------------------------
# AI enrichment request — sent after user reviews NLP candidates
# ---------------------------------------------------------------------------

class AIEnrichOptions(BaseModel):
    characters_ai: bool = False
    locations_ai: bool = False
    relationships_ai: bool = False


class EnrichCandidatesRequest(BaseModel):
    candidates: list[ExtractionCandidate]
    options: AIEnrichOptions


# ---------------------------------------------------------------------------
# Finalize — selections to create after user review
# ---------------------------------------------------------------------------

class ExtractionSelection(BaseModel):
    """Which candidates the user approved for creation."""
    candidate_ids: list[str] = []


class ExtractionResult(BaseModel):
    created_characters: int = 0
    created_locations: int = 0
    created_relationships: int = 0
