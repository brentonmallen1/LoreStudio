"""
Schemas for the document import wizard.

Import flow:
  Upload → ParsedDocument → ImportPreviewTree → (user edits) → FinalizeRequest → Story
"""
from typing import Literal, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Internal: paragraph/break structures (used by the service layer)
# ---------------------------------------------------------------------------

class ParsedParagraph(BaseModel):
    """A paragraph extracted from the source document after pandoc conversion."""
    index: int             # 0-based position in document
    html: str              # Original HTML from pandoc (never altered)
    text_preview: str      # First 120 chars of plain text (for AI prompt)
    tag: str               # Source HTML tag: "h1"-"h6", "p", "hr"
    word_count: int


class BreakPosition(BaseModel):
    """A detected or suggested structural break."""
    after_index: int       # Split AFTER this paragraph index
    level: int             # Target hierarchy level (0=top, 1=chapter, 2=scene)
    source: Literal["heuristic", "ai", "user"]
    confidence: float      # 0.0–1.0
    reasoning: Optional[str] = None


# ---------------------------------------------------------------------------
# AI output schema (used with generate_structured)
# ---------------------------------------------------------------------------

class AIBreakSuggestion(BaseModel):
    """Structured output from the AI — positions only, no content.

    All fields are optional with defaults so partial responses still succeed validation.
    """
    scene_breaks_after: list[int] = []
    chapter_breaks_after: list[int] = []
    part_breaks_after: list[int] = []
    title_suggestions: dict[str, str] = {}
    reasoning: str = ""


# ---------------------------------------------------------------------------
# Preview tree (sent to frontend and back)
# ---------------------------------------------------------------------------

class PreviewNode(BaseModel):
    id: str
    parent_id: Optional[str] = None
    title: str
    level: int             # 0=top (Act), 1=mid (Chapter), 2=leaf (Scene)
    level_type: str        # "act", "chapter", "scene", etc. from template
    content_preview: str   # First 200 chars of plain text
    word_count: int
    source: Literal["heuristic", "ai", "user"]  # how this node was created
    confidence: float      # 1.0 for heuristic headings, lower for AI suggestions
    needs_review: bool     # flag for low-confidence or ambiguous sections
    paragraph_start: int   # first paragraph index in this node
    paragraph_end: int     # last paragraph index (inclusive)


class ImportPreviewTree(BaseModel):
    session_id: str
    source_format: str          # "docx", "markdown", "txt", "rtf"
    detected_title: Optional[str] = None
    template_id: str
    template_levels: list[dict]  # [{name: "Act", plural: "Acts"}, ...]
    nodes: list[PreviewNode]
    warnings: list[str]
    total_word_count: int


# ---------------------------------------------------------------------------
# API request/response shapes
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    """Returned immediately after file upload and heuristic parsing."""
    session_id: str
    source_format: str
    detected_title: Optional[str] = None
    preview: ImportPreviewTree
    has_unstructured_blocks: bool   # hint to show "Get AI Suggestions"
    ai_available: bool              # whether Ollama is reachable


class AIAnalyzeResponse(BaseModel):
    """Returned after AI structure analysis."""
    preview: ImportPreviewTree      # updated preview with AI suggestions merged in
    suggestions_applied: int        # how many AI breaks were inserted
    reasoning: str


class NodeAdjustment(BaseModel):
    """A single user edit to the preview tree."""
    action: Literal["rename", "merge_up", "split", "relevel"]
    node_id: str
    # rename
    new_title: Optional[str] = None
    # split: paragraph index within the node to split at
    split_at_paragraph: Optional[int] = None
    # relevel
    new_level: Optional[int] = None


class UpdatePreviewRequest(BaseModel):
    adjustments: list[NodeAdjustment]


class FinalizeImportRequest(BaseModel):
    title: str
    description: str = ""
    template_id: str
    genre: str = ""
    # Entity extraction: IDs of candidates the user approved for creation
    extraction_candidate_ids: list[str] = []
    # Full candidate list (with extracted data) needed to create entities
    extraction_candidates: list = []
