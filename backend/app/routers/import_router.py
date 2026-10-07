"""
Import router — document upload, structure preview, and story creation.

Session lifecycle (in-memory, 30-minute TTL):
  POST /import/upload              → creates session, returns preview
  POST /import/{session_id}/ai-analyze → AI break suggestions (user-initiated)
  POST /import/{session_id}/adjust → apply user edits to preview
  POST /import/{session_id}/finalize   → create story from final preview

All endpoints require authentication.
"""

import logging
import time
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.ai_job import AIJob
from ..models.structure import StoryStructureTemplate
from ..models.user import User
from ..schemas.import_extraction import (
    EnrichCandidatesRequest,
    ExtractionOptions,
    ExtractionPreview,
)
from ..schemas.import_schemas import (
    AIAnalyzeResponse,
    FinalizeImportRequest,
    ImportPreviewTree,
    ParsedParagraph,
    UpdatePreviewRequest,
    UploadResponse,
)
from ..schemas.jobs import JobOut
from ..services.import_service import (
    _merge_breaks,
    apply_adjustment,
    apply_breaks,
    build_preview_tree,
    create_entities_from_extraction,
    create_story_from_import,
    detect_structure_ai,
    detect_structure_heuristic,
    extract_entities_ai,
    extract_entities_nlp,
    parse_document,
)
from ..services.job_queue import enqueue, handler

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------

SESSION_TTL = 30 * 60  # 30 minutes in seconds


class _ImportSession:
    def __init__(
        self,
        session_id: str,
        user_id: str,
        paragraphs: list[ParsedParagraph],
        preview: ImportPreviewTree,
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.paragraphs = paragraphs
        self.preview = preview
        self.created_at = time.monotonic()

    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > SESSION_TTL


_sessions: dict[str, _ImportSession] = {}


def _purge_expired() -> None:
    expired = [sid for sid, s in _sessions.items() if s.is_expired()]
    for sid in expired:
        del _sessions[sid]


def _get_session(session_id: str, user_id: str) -> _ImportSession:
    _purge_expired()
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Import session not found or expired")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your import session")
    return session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/rtf",
    "text/rtf",
    "application/x-rtf",
    "text/markdown",
    "text/plain",
    "text/x-markdown",
    "application/epub+zip",
    # browsers often send these for .docx
    "application/zip",
    "application/octet-stream",
}

ALLOWED_EXTENSIONS = {".docx", ".doc", ".rtf", ".md", ".markdown", ".txt", ".epub"}
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB


def _get_template(template_id: str, db: Session) -> StoryStructureTemplate | None:
    return db.query(StoryStructureTemplate).filter(StoryStructureTemplate.id == template_id).first()


def _template_levels(template: StoryStructureTemplate | None) -> list[dict]:
    if template:
        return template.levels
    # Default freeform: section → scene
    return [{"name": "Section", "plural": "Sections"}, {"name": "Scene", "plural": "Scenes"}]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/import/upload", response_model=UploadResponse)
async def upload_for_import(
    file: UploadFile = File(...),
    template_id: str = Query(default="freeform"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a document and receive a heuristic structure preview.

    Supported formats: DOCX, DOC, RTF, Markdown, plain text.
    Returns a session_id for subsequent wizard steps.
    """
    _purge_expired()

    # Validate file extension
    filename = file.filename or "upload"
    import os

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 30 MB)")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    mime = file.content_type or "application/octet-stream"

    # Parse document via pandoc
    try:
        paragraphs, detected_title, source_format = parse_document(content, filename, mime)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=f"Could not parse document: {e}")

    if not paragraphs:
        raise HTTPException(status_code=422, detail="Document appears to be empty")

    # Load template
    template = _get_template(template_id, db)
    template_levels = _template_levels(template)

    # Heuristic detection
    breaks = detect_structure_heuristic(paragraphs)
    sections = apply_breaks(paragraphs, breaks, template_levels)

    session_id = str(uuid.uuid4())
    preview = build_preview_tree(
        sections=sections,
        paragraphs=paragraphs,
        session_id=session_id,
        template_id=template_id,
        template_levels=template_levels,
        source_format=source_format,
        detected_title=detected_title,
    )

    # Check if Ollama is reachable (non-blocking check)
    ai_available = False
    try:
        from ..services.llm.ollama import ollama_provider

        ai_available = await ollama_provider.is_available()
    except Exception:
        pass

    # Determine if AI suggestions would be useful
    has_unstructured = any(
        n.word_count > 2000 and n.source == "heuristic" and n.confidence < 0.8 for n in preview.nodes
    )
    if len(preview.nodes) == 1:
        has_unstructured = True

    # Store session
    _sessions[session_id] = _ImportSession(
        session_id=session_id,
        user_id=current_user.id,
        paragraphs=paragraphs,
        preview=preview,
    )

    return UploadResponse(
        session_id=session_id,
        source_format=source_format,
        detected_title=detected_title,
        preview=preview,
        has_unstructured_blocks=has_unstructured,
        ai_available=ai_available,
    )


@router.post("/import/{session_id}/ai-analyze", response_model=AIAnalyzeResponse)
async def ai_analyze_structure(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run AI structure detection on the session's document.

    AI returns only paragraph break positions — no content is regenerated.
    The preview is updated with AI-suggested breaks merged in.
    """
    from ..services.llm.gateway import AICallContext

    session = _get_session(session_id, current_user.id)
    paragraphs = session.paragraphs
    preview = session.preview
    template_levels = preview.template_levels

    ctx = AICallContext(
        feature="import-structure",
        user_id=current_user.id,
    )

    ai_breaks, ai_error = await detect_structure_ai(paragraphs, template_levels, ctx, db, current_user)
    if ai_breaks is None:
        raise HTTPException(
            status_code=503,
            detail=ai_error or "AI analysis unavailable. Is Ollama running?",
        )

    # Merge with heuristic breaks already in the preview
    # Re-derive heuristic breaks from current nodes as a baseline
    heuristic_breaks = detect_structure_heuristic(paragraphs)
    merged_breaks = _merge_breaks(heuristic_breaks, ai_breaks)

    sections = apply_breaks(paragraphs, merged_breaks, template_levels)
    updated_preview = build_preview_tree(
        sections=sections,
        paragraphs=paragraphs,
        session_id=session_id,
        template_id=preview.template_id,
        template_levels=template_levels,
        source_format=preview.source_format,
        detected_title=preview.detected_title,
    )

    session.preview = updated_preview

    ai_suggestions_applied = sum(1 for b in ai_breaks if b.source == "ai")
    reasoning = (
        "AI found no additional structural breaks."
        if not ai_breaks
        else (
            f"AI identified {ai_suggestions_applied} additional break(s). "
            "Review the highlighted sections and adjust as needed."
        )
    )

    return AIAnalyzeResponse(
        preview=updated_preview,
        suggestions_applied=ai_suggestions_applied,
        reasoning=reasoning,
    )


@router.post("/import/{session_id}/adjust", response_model=ImportPreviewTree)
def adjust_preview(
    session_id: str,
    body: UpdatePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Apply user edits (rename, merge, relevel) to the import preview.
    Returns the updated preview tree.
    """
    session = _get_session(session_id, current_user.id)

    preview = session.preview
    for adjustment in body.adjustments:
        preview = apply_adjustment(preview, session.paragraphs, adjustment)

    session.preview = preview
    return preview


@router.post("/import/{session_id}/extract-preview", response_model=ExtractionPreview)
async def extract_preview(
    session_id: str,
    options: ExtractionOptions,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run entity extraction on the imported document.

    Stage 1 (NLP): spaCy NER identifies character/location name candidates.
    Stage 2 (AI, optional): Ollama extracts attributes for each candidate.

    Returns an ExtractionPreview for user review. Does NOT create entities yet.
    """
    import time

    from ..services.llm.gateway import AICallContext

    session = _get_session(session_id, current_user.id)

    # Stage 1: NLP
    nlp_start = time.monotonic()
    candidates = extract_entities_nlp(session.paragraphs, session.preview.nodes, options)
    nlp_elapsed = int((time.monotonic() - nlp_start) * 1000)

    # Check AI availability
    ai_available = False
    try:
        from ..services.llm.ollama import ollama_provider

        ai_available = await ollama_provider.is_available()
    except Exception:
        pass

    ai_elapsed: int | None = None

    # Stage 2: AI enrichment (only if AI is enabled in options and Ollama is up)
    needs_ai = options.characters_ai or options.locations_ai or options.relationships_ai
    if needs_ai and ai_available and candidates:
        ai_start = time.monotonic()
        ctx = AICallContext(
            feature="import-extraction",
            user_id=current_user.id,
        )
        candidates = await extract_entities_ai(
            candidates=candidates,
            paragraphs=session.paragraphs,
            preview_nodes=session.preview.nodes,
            options=options,
            ctx=ctx,
            db=db,
            user=current_user,
        )
        ai_elapsed = int((time.monotonic() - ai_start) * 1000)

    return ExtractionPreview(
        candidates=candidates,
        ai_available=ai_available,
        nlp_elapsed_ms=nlp_elapsed,
        ai_elapsed_ms=ai_elapsed,
    )


@router.post("/import/{session_id}/enrich-candidates", response_model=ExtractionPreview)
async def enrich_candidates(
    session_id: str,
    body: EnrichCandidatesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run AI enrichment on a user-approved set of NLP candidates.

    Called after the user has reviewed NLP results and removed false positives.
    Takes the approved candidates (with scene_ids) and extracts attributes via Ollama.
    """
    import time

    from ..services.llm.gateway import AICallContext

    session = _get_session(session_id, current_user.id)

    # Check AI availability
    ai_available = False
    try:
        from ..services.llm.ollama import ollama_provider

        ai_available = await ollama_provider.is_available()
    except Exception:
        pass

    if not ai_available:
        raise HTTPException(status_code=503, detail="Ollama is unavailable. Is it running?")

    # Convert options: wrap AIEnrichOptions into ExtractionOptions shape
    options = ExtractionOptions(
        characters_nlp=False,
        locations_nlp=False,
        characters_ai=body.options.characters_ai,
        locations_ai=body.options.locations_ai,
        relationships_ai=body.options.relationships_ai,
    )

    ctx = AICallContext(
        feature="import-extraction",
        user_id=current_user.id,
    )

    ai_start = time.monotonic()
    enriched = await extract_entities_ai(
        candidates=body.candidates,
        paragraphs=session.paragraphs,
        preview_nodes=session.preview.nodes,
        options=options,
        ctx=ctx,
        db=db,
        user=current_user,
    )
    ai_elapsed = int((time.monotonic() - ai_start) * 1000)

    return ExtractionPreview(
        candidates=enriched,
        ai_available=True,
        nlp_elapsed_ms=0,
        ai_elapsed_ms=ai_elapsed,
    )


@router.get("/import/{session_id}")
def import_status(session_id: str, current_user: User = Depends(get_current_user)):
    """Whether an import is still open here: the wizard resumes one only while it is."""
    _get_session(session_id, current_user.id)
    return {"alive": True}


@handler("import-enrich", stop="now", unique=True)
async def _run_enrich(job: AIJob, db: Session, user: User, report) -> dict:
    """The Assistant reading people and places in an import, as a job (doc 21 R8): it carries
    on if the wizard is closed, and the wizard reads its result back when reopened. No story
    exists yet, so the job has none; it needs the import's session, kept in this process."""
    from ..services.llm.gateway import AICallContext

    session = _sessions.get(job.params.get("session_id", ""))
    if session is None or session.user_id != user.id or session.is_expired():
        raise RuntimeError("This import has closed. Upload the document again.")
    session.created_at = time.monotonic()  # a long read keeps the import open
    body = EnrichCandidatesRequest.model_validate(job.params)
    options = ExtractionOptions(
        characters_nlp=False,
        locations_nlp=False,
        characters_ai=body.options.characters_ai,
        locations_ai=body.options.locations_ai,
        relationships_ai=body.options.relationships_ai,
    )
    report(0, 0, "Reading people and places")
    started = time.monotonic()
    enriched = await extract_entities_ai(
        candidates=body.candidates,
        paragraphs=session.paragraphs,
        preview_nodes=session.preview.nodes,
        options=options,
        ctx=AICallContext(feature="import-extraction", user_id=user.id),
        db=db,
        user=user,
        on_progress=lambda done, total: report(done, total),
    )
    session.created_at = time.monotonic()
    return ExtractionPreview(
        candidates=enriched,
        ai_available=True,
        nlp_elapsed_ms=0,
        ai_elapsed_ms=int((time.monotonic() - started) * 1000),
    ).model_dump(mode="json")


@router.post("/import/{session_id}/enrich-candidates/jobs", response_model=JobOut, status_code=201)
def queue_enrich(
    session_id: str,
    body: EnrichCandidatesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue the Assistant's reading of the approved candidates."""
    session = _get_session(session_id, current_user.id)
    title = session.preview.detected_title or "the document"
    return enqueue(
        db,
        kind="import-enrich",
        user_id=current_user.id,
        label=f"Import: reading people and places in {title}",
        params={"session_id": session_id, **body.model_dump(mode="json")},
    )


@router.post("/import/{session_id}/finalize")
def finalize_import(
    session_id: str,
    body: FinalizeImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new story from the finalized import structure.

    Content is assembled from original document paragraphs — never regenerated.
    Returns the created story id and title.
    """
    session = _get_session(session_id, current_user.id)

    # Validate template still exists (user might have changed it)
    template = _get_template(body.template_id, db)
    if not template:
        raise HTTPException(status_code=400, detail=f"Template '{body.template_id}' not found")

    # If template changed, rebuild preview with new level names
    preview = session.preview
    if body.template_id != preview.template_id:
        from ..services.import_service import apply_breaks, build_preview_tree, detect_structure_heuristic

        template_levels = _template_levels(template)
        heuristic_breaks = detect_structure_heuristic(session.paragraphs)
        sections = apply_breaks(session.paragraphs, heuristic_breaks, template_levels)
        preview = build_preview_tree(
            sections=sections,
            paragraphs=session.paragraphs,
            session_id=session_id,
            template_id=body.template_id,
            template_levels=template_levels,
            source_format=preview.source_format,
            detected_title=preview.detected_title,
        )

    try:
        story = create_story_from_import(
            preview=preview,
            paragraphs=session.paragraphs,
            request=body,
            user_id=current_user.id,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")

    # Create extracted entities if user selected any
    entity_counts = {"created_characters": 0, "created_locations": 0, "created_relationships": 0}
    if body.extraction_candidate_ids and body.extraction_candidates:
        try:
            from ..schemas.import_extraction import ExtractionCandidate

            candidates = [ExtractionCandidate.model_validate(c) for c in body.extraction_candidates]
            selected_ids = set(body.extraction_candidate_ids)
            entity_counts = create_entities_from_extraction(candidates, selected_ids, story.id, db)
        except Exception as e:
            logger.warning("Entity extraction creation failed (non-fatal): %s", e)

    # Clean up session
    _sessions.pop(session_id, None)

    return {"id": story.id, "title": story.title, **entity_counts}
