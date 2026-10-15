"""
Import router — document upload, structure preview, and story creation.

A Fountain or Final Draft file takes the same steps (doc 25, P6): services/import_script reads
the structure and the Lorebook entries it states, and makes the story a screenplay.

Session lifecycle (in-memory, 30-minute TTL):
  POST /import/upload              → creates session, returns preview
  POST /import/{session_id}/ai-analyze → AI break suggestions (user-initiated)
  POST /import/{session_id}/adjust → apply user edits to preview
  POST /import/{session_id}/undo   → take back the last edit (adjust or ai-analyze)
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
from ..schemas.import_novelcrafter import NovelcrafterChoices
from ..schemas.import_schemas import (
    AIAnalyzeResponse,
    FinalizeImportRequest,
    ImportPreviewTree,
    ParsedParagraph,
    UpdatePreviewRequest,
    UploadResponse,
)
from ..schemas.jobs import JobOut
from ..services import import_records
from ..services.import_review import apply_adjustment, prose_sections, relabel, resegment
from ..services.import_script import (
    SCRIPT_EXTENSIONS,
    ScriptImport,
    is_script_file,
    read_script,
    script_preview,
)
from ..services.import_script import candidates as script_candidates
from ..services.import_script import finish as finish_script
from ..services.import_service import (
    _merge_breaks,
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
from ..services.novelcrafter.importing import TEMPLATE as NC_TEMPLATE
from ..services.novelcrafter.importing import NovelcrafterImport, as_script_import, open_export, retitle
from ..services.novelcrafter.importing import finish as finish_novelcrafter
from ..services.novelcrafter.reader import looks_like_export

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
        script: ScriptImport | None = None,
        novelcrafter: NovelcrafterImport | None = None,
        filename: str = "",
        original: bytes = b"",
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.paragraphs = paragraphs
        self.preview = preview
        self.script = script
        self.novelcrafter = novelcrafter
        #: The file as uploaded: kept with the story, so the import can always be checked (doc 28).
        self.filename = filename
        self.original = original
        #: The previews before each edit in Review structure, newest last: what Undo goes back to.
        self.history: list[ImportPreviewTree] = []
        self.created_at = time.monotonic()

    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > SESSION_TTL


_sessions: dict[str, _ImportSession] = {}


UNDO_LIMIT = 50


def _set_preview(session: _ImportSession, preview: ImportPreviewTree) -> ImportPreviewTree:
    """An edit in Review structure: the old preview goes on the Undo stack when anything moved."""
    if preview.nodes != session.preview.nodes:
        session.history = [*session.history, session.preview][-UNDO_LIMIT:]
    session.preview = preview.model_copy(update={"undo_depth": len(session.history)})
    return session.preview


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

ALLOWED_EXTENSIONS = {".docx", ".doc", ".rtf", ".md", ".markdown", ".txt", ".epub", ".zip", *SCRIPT_EXTENSIONS}
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB


def _get_template(template_id: str, db: Session) -> StoryStructureTemplate | None:
    return db.query(StoryStructureTemplate).filter(StoryStructureTemplate.id == template_id).first()


def _preview(paragraphs, script, session_id, template_id, template_levels, source_format, detected_title):
    """The structure the wizard opens on: what a script states, or what headings and breaks suggest."""
    if script:
        return script_preview(
            script,
            paragraphs,
            session_id=session_id,
            template_id=template_id,
            template_levels=template_levels,
            source_format=source_format,
            detected_title=detected_title,
        )
    return build_preview_tree(
        sections=prose_sections(paragraphs, detect_structure_heuristic(paragraphs), template_levels),
        paragraphs=paragraphs,
        session_id=session_id,
        template_id=template_id,
        template_levels=template_levels,
        source_format=source_format,
        detected_title=detected_title,
    )


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

    # Parse document via pandoc; a script file reads itself; a Novelcrafter export opens its manuscript
    script: ScriptImport | None = None
    nc: NovelcrafterImport | None = None
    try:
        if is_script_file(filename):
            paragraphs, detected_title, source_format, script = read_script(content, filename)
        elif ext == ".zip":
            if not looks_like_export(content):
                raise HTTPException(status_code=415, detail="This zip is not a Novelcrafter export")
            paragraphs, detected_title, nc = open_export(content)
            source_format = "novelcrafter"
            if template_id == "freeform" and _get_template(NC_TEMPLATE, db):
                template_id = NC_TEMPLATE
        else:
            paragraphs, detected_title, source_format = parse_document(content, filename, mime)
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse document: {e}")

    if not paragraphs:
        raise HTTPException(status_code=422, detail="Document appears to be empty")

    # Load template
    template = _get_template(template_id, db)
    template_levels = _template_levels(template)

    session_id = str(uuid.uuid4())
    preview = _preview(paragraphs, script, session_id, template_id, template_levels, source_format, detected_title)
    if nc:
        preview = retitle(preview)

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
    if script:
        has_unstructured = False  # a script states its own scenes

    # Store session
    _sessions[session_id] = _ImportSession(
        session_id=session_id,
        user_id=current_user.id,
        paragraphs=paragraphs,
        preview=preview,
        script=script,
        novelcrafter=nc,
        filename=filename,
        original=content,
    )

    return UploadResponse(
        session_id=session_id,
        source_format=source_format,
        detected_title=detected_title,
        preview=preview,
        has_unstructured_blocks=has_unstructured,
        ai_available=ai_available,
        novelcrafter=nc.preview if nc else None,
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

    # The headings and breaks the document states, with the AI's suggestions merged in
    merged_breaks = _merge_breaks(detect_structure_heuristic(paragraphs), ai_breaks)
    updated_preview = _set_preview(
        session,
        resegment(preview, paragraphs, merged_breaks, retitle=retitle if session.novelcrafter else None),
    )

    ai_suggestions_applied = sum(1 for b in merged_breaks if b.source == "ai")
    reasoning = (
        "AI found no additional structural breaks."
        if not ai_suggestions_applied
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

    return _set_preview(session, preview)


@router.post("/import/{session_id}/undo", response_model=ImportPreviewTree)
def undo_preview_edit(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Take back the last edit in Review structure: a rename, merge, level change or Auto-segment."""
    session = _get_session(session_id, current_user.id)
    if not session.history:
        raise HTTPException(status_code=409, detail="Nothing to undo")
    *session.history, previous = session.history
    session.preview = previous.model_copy(update={"undo_depth": len(session.history)})
    return session.preview


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

    # Stage 1: NLP (a script names its people in its cues and its places in its headings)
    nlp_start = time.monotonic()
    if session.script:
        candidates = script_candidates(session.script, session.paragraphs, session.preview.nodes, options)
    else:
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

    # Another template: the same structure under its names when it has as many levels; a script
    # states its own structure again; anything else would lose the review, so it asks for one.
    preview = session.preview
    levels = _template_levels(template)
    if body.template_id != preview.template_id and len(levels) == len(preview.template_levels):
        preview = relabel(preview, body.template_id, levels)
    elif body.template_id != preview.template_id and not session.script:
        raise HTTPException(status_code=409, detail="Review the structure again for this template")
    elif body.template_id != preview.template_id:
        preview = _preview(
            session.paragraphs,
            session.script,
            session_id,
            body.template_id,
            levels,
            preview.source_format,
            preview.detected_title,
        )

    # A Novelcrafter manuscript written as a script, imported as one when the author chose to.
    choices = body.novelcrafter or NovelcrafterChoices()
    paragraphs, script = session.paragraphs, session.script
    if session.novelcrafter and choices.screenplay:
        paragraphs, script = as_script_import(paragraphs, session.novelcrafter.author)

    try:
        story = create_story_from_import(
            preview=preview,
            paragraphs=paragraphs,
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
    if script:
        finish_script(story, script, preview, db)

    record_id = _record(session, story, choices, db, current_user.id)
    _keep_as_imported(story.id, db)

    # Clean up session
    _sessions.pop(session_id, None)

    return {"id": story.id, "title": story.title, "record_id": record_id, **entity_counts}


def _keep_as_imported(story_id: str, db: Session) -> None:
    """A named version of the story as it came in, so Chronicle › Versions can always go back."""
    from ..services.dialogue_service import sync_story_dialogue
    from ..services.snapshot_service import create_snapshot

    try:
        # Its dialogue read first, as opening the story would: otherwise the first auto-backup
        # holds nothing but those rows.
        sync_story_dialogue(story_id, db)
        db.commit()
        create_snapshot(story_id, db, trigger="manual", name="As imported", force=True)
    except Exception as e:  # the story stands; only its first version is missing
        logger.warning("As imported version failed (non-fatal): %s", e)
        db.rollback()


def _record(session: _ImportSession, story, choices: NovelcrafterChoices, db: Session, user_id: str) -> str | None:
    """The import's record (doc 28). A Novelcrafter export's Lorebook is made here too: if that
    fails the new story goes with it, rather than standing there half made."""
    if session.novelcrafter:
        try:
            nc = session.novelcrafter
            record = finish_novelcrafter(
                story, nc, choices, filename=session.filename, data=session.original, user_id=user_id, db=db
            )
            return record.id
        except Exception as e:
            logger.exception("Novelcrafter import failed")
            db.rollback()
            db.delete(story)
            db.commit()
            raise HTTPException(status_code=500, detail=f"Import failed: {e}")
    try:
        source = "script" if session.script else "document"
        record = import_records.start(
            story, source=source, filename=session.filename, data=session.original, user_id=user_id, db=db
        )
        import_records.manuscript(record, story, db)
        db.commit()
        return record.id
    except Exception as e:  # the story stands; only its record is missing
        logger.warning("Import record failed (non-fatal): %s", e)
        db.rollback()
        return None
