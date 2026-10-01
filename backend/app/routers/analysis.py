from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.character import Character, CharacterRelationship
from ..models.interview import CharacterInterview
from ..models.location import Location
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import (
    ArcAnalysisResponse,
    AudienceAdherenceResponse,
    CharacterDimensionalityResponse,
    ClicheAnalysisResponse,
    ContinuityCheckResponse,
    DiscoveryQuestionsResponse,
    EconomyAnalysisResponse,
    EssentialQuestionsResponse,
    FirstPassAnalysisResponse,
    PacingAnalysisResponse,
    PlotHoleDetectionResponse,
    ShowDontTellAnalysisResponse,
    StructuredResult,
    ThemeTrackerResponse,
    ThreadAnalysisResponse,
)
from ..schemas.chronicle import ActivityLogOut
from ..schemas.mentions import MentionedRef
from ..schemas.nlp_analysis import (
    EditorialConsistencyResponse,
    EntitySuggestionsResponse,
    ProseNLPResponse,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.analysis import (
    TARGET_AUDIENCES,
    build_arc_analysis_prompt,
    build_audience_adherence_prompt,
    build_character_arc_prompt,
    build_character_dimensionality_prompt,
    build_cliche_analysis_prompt,
    build_cliche_coach_system_prompt,
    build_continuity_check_prompt,
    build_discovery_questions_prompt,
    build_economy_analysis_prompt,
    build_essential_questions_prompt,
    build_first_pass_prompt,
    build_pacing_analysis_prompt,
    build_plot_hole_detection_prompt,
    build_session_recap_prompt,
    build_show_dont_tell_prompt,
    build_theme_tracker_prompt,
    build_thread_analysis_prompt,
)
from ..services.llm.prompts.summaries import build_structure_section_summary_prompt
from ..services.llm.sse import sse_message, sse_stream
from ..services.nlp_runs import run_editorial_consistency, run_entity_scan, run_prose_analysis
from ..services.scene_summaries import refresh_scene_summaries
from ..services.word_count import WORD_COUNT_RANGES
from ..services.wording import count

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories/{story_id}/summarize/structure")
async def summarize_structure_section(
    story_id: str,
    node_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summarize a specific act, chapter, or section."""
    story = _get_story(story_id, db, current_user)
    node = db.get(StructureNode, node_id)
    if not node or node.story_id != story_id:
        raise HTTPException(status_code=404, detail="Section not found")

    # Load all nodes in the section in one query, build child map in Python
    all_section_nodes = (
        db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position).all()
    )
    child_map: dict[str | None, list[StructureNode]] = {}
    for n in all_section_nodes:
        child_map.setdefault(n.parent_id, []).append(n)

    def gather_content(n: StructureNode) -> list[str]:
        pieces = []
        if n.content and n.content.strip():
            pieces.append(f"[{n.title}]\n{n.content}")
        for child in sorted(child_map.get(n.id, []), key=lambda c: c.position):
            pieces.extend(gather_content(child))
        return pieces

    content_pieces = gather_content(node)
    if not content_pieces:
        return sse_message(f"'{node.title}' has no written content yet.")

    content_text = "\n\n".join(content_pieces)
    feature_prompt = build_structure_section_summary_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        node_title=node.title,
        content_text=content_text,
    )
    llm_messages = [{"role": "user", "content": "Summarize this section."}]

    ctx = AICallContext(
        feature="structure-summary",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "summarization", "analysis", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/summarize/character")
async def summarize_character_arc(
    story_id: str,
    character_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summarize where a character is in their arc based on written content."""
    story = _get_story(story_id, db, current_user)
    character = db.get(Character, character_id)
    if not character or character.story_id != story_id:
        raise HTTPException(status_code=404, detail="Character not found")

    # Get all scene content mentioning the character
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    relevant_scenes = [
        f"[{n.title}]\n{n.content}" for n in all_nodes if n.content and character.name.lower() in n.content.lower()
    ]

    profile_parts = []
    if character.personality:
        profile_parts.append(f"Personality: {character.personality}")
    if character.motivation:
        profile_parts.append(f"Motivation: {character.motivation}")
    if character.arc_notes:
        profile_parts.append(f"Arc notes: {character.arc_notes}")
    if character.narrative_intent:
        profile_parts.append(f"Author's planned arc: {character.narrative_intent}")

    milestones_text = ""
    if character.arc_milestones:
        ms = character.arc_milestones
        done = [m["text"] for m in ms if m.get("completed")]
        pending = [m["text"] for m in ms if not m.get("completed")]
        if done:
            milestones_text += f"\nCompleted milestones: {', '.join(done)}"
        if pending:
            milestones_text += f"\nRemaining milestones: {', '.join(pending)}"

    scenes_text = "\n\n".join(relevant_scenes) if relevant_scenes else "No scenes mentioning this character yet."

    feature_prompt = build_character_arc_prompt(
        character=character,
        story_title=story.title,
        profile_parts=profile_parts,
        milestones_text=milestones_text,
        scenes_text=scenes_text,
    )
    llm_messages = [{"role": "user", "content": f"Where is {character.name} in their arc?"}]

    ctx = AICallContext(
        feature="character-arc",
        user_id=current_user.id,
        story_id=story_id,
        character_id=character_id,
        tags=["character", "analysis", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/analyze/economy", response_model=StructuredResult)
async def analyze_economy(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze story economy against MICE principles for short fiction."""
    story = _get_story(story_id, db, current_user)

    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    # Build leaf nodes in order without touching the ORM relationship.
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        leaves = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                leaves.append(n)
            else:
                leaves.extend(flatten_leaves(kids))
        return leaves

    leaves = flatten_leaves(roots)
    total_words = sum(n.word_count for n in all_nodes)

    # Build MICE thread summary
    threads_summary = []
    for t in threads:
        threads_summary.append(
            f'- "{t.name}" [{t.mice_type or "untyped"}] — status: {t.status}, '
            f"appears in {len(t.appearances)} scene(s), "
            f"{len(t.try_fail_cycles or [])} try/fail cycle(s)"
        )

    # Scene summary (which threads are tagged per scene)
    scene_thread_map: dict[str, list[str]] = {}
    for t in threads:
        for a in t.appearances:
            scene_thread_map.setdefault(a.node_id, []).append(t.name)

    scenes_info = []
    for leaf in leaves:
        thread_names = scene_thread_map.get(leaf.id, [])
        scenes_info.append(
            f'- "{leaf.title or "Untitled"}" ({leaf.word_count} words, {leaf.status})'
            + (f" — serves: {', '.join(thread_names)}" if thread_names else " — NO THREAD")
        )

    # Word count context
    length_key = story.intended_length or ""
    length_range = WORD_COUNT_RANGES.get(length_key, {})
    length_context = ""
    if length_range.get("max"):
        length_context = (
            f"Intended form: {length_key.replace('_', ' ')} "
            f"(target: up to {length_range['max']:,} words). "
            f"Current: {total_words:,} words.\n"
        )

    feature_prompt = build_economy_analysis_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        length_context=length_context,
        threads_summary=threads_summary,
        scenes_info=scenes_info,
    )
    llm_messages = [{"role": "user", "content": "Analyze this story's economy."}]

    ctx = AICallContext(
        feature="economy-analysis",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=EconomyAnalysisResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description="Economy analysis completed",
        metadata_={
            "feature": "economy-analysis",
            "result": result.model_dump() if hasattr(result, "model_dump") else result,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/recap")
async def recap_last_session(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a natural-language recap of what the writer worked on recently.
    Gathers: recently edited scenes (with content), recent activity logs,
    recent character interviews — then streams a brief, warm summary.
    """
    story = _get_story(story_id, db, current_user)

    # ── Recently edited scenes (last 5, with content) ──
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    parent_ids: set[str] = {n.parent_id for n in all_nodes if n.parent_id}
    leaf_nodes = [n for n in all_nodes if n.id not in parent_ids]

    recent_scenes = sorted(
        [n for n in leaf_nodes if n.word_count > 0],
        key=lambda n: n.updated_at,
        reverse=True,
    )[:5]

    scenes_text = ""
    if recent_scenes:
        lines = []
        for n in recent_scenes:
            summary = n.content_summary.strip() if n.content_summary else ""
            synopsis = n.synopsis.strip() if n.synopsis else ""
            description = summary or synopsis or "(no summary)"
            lines.append(f'- "{n.title}" ({n.word_count} words, {n.status}): {description}')
        scenes_text = "\n".join(lines)

    # ── Recent activity logs ──
    recent_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.story_id == story_id, ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    activity_text = ""
    if recent_logs:
        activity_text = "\n".join(f"- {log.event_type}: {log.description}" for log in recent_logs)

    # ── Recent interviews ──
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    char_name_map = {c.id: c.name for c in characters}
    char_ids = [c.id for c in characters]
    recent_interviews = []
    if char_ids:
        recent_interviews = (
            db.query(CharacterInterview)
            .filter(CharacterInterview.character_id.in_(char_ids))
            .order_by(CharacterInterview.updated_at.desc())
            .limit(3)
            .all()
        )
    interviews_text = ""
    if recent_interviews:
        lines = []
        for iv in recent_interviews:
            char_name = char_name_map.get(iv.character_id, "unknown character")
            msg_count = len(iv.messages or [])
            notes_snippet = iv.interview_notes[:200].strip() if iv.interview_notes else ""
            lines.append(
                f'- Interview with {char_name} ("{iv.title or "untitled"}", {msg_count} messages)'
                + (f": {notes_snippet}" if notes_snippet else "")
            )
        interviews_text = "\n".join(lines)

    # ── Nothing to recap ──
    if not recent_scenes and not recent_logs and not recent_interviews:
        return sse_message("Nothing to recap yet: no scenes, activity or interviews recorded for this story.")

    feature_prompt = build_session_recap_prompt(
        story_title=story.title,
        story_overview=story.logline or story.premise or story.narrative_intent or "No description provided.",
        scenes_text=scenes_text,
        activity_text=activity_text,
        interviews_text=interviews_text,
    )
    llm_messages = [{"role": "user", "content": "Give me a recap of what I've been working on."}]

    ctx = AICallContext(
        feature="session-recap",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/threads/{thread_id}/analyze", response_model=StructuredResult)
async def analyze_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze a plot thread's progression, moment mapping, and quality."""
    thread = db.get(PlotThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    story = db.query(Story).filter(Story.id == thread.story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Gather scene content for scenes tagged to this thread
    tagged_node_ids = {a.node_id for a in thread.appearances}
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == thread.story_id).all()

    scenes = []
    for n in all_nodes:
        if n.id in tagged_node_ids and n.content:
            scenes.append(
                {
                    "id": n.id,
                    "title": n.title or "Untitled",
                    "content_excerpt": n.content,
                }
            )

    story_context = story.logline or story.premise or story.narrative_intent or ""

    feature_prompt = build_thread_analysis_prompt(
        thread=thread,
        story_title=story.title,
        story_context=story_context,
        scenes=scenes,
    )

    ctx = AICallContext(
        feature="thread-analysis",
        user_id=current_user.id,
        story_id=story.id,
        tags=["threads", "analysis", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=ThreadAnalysisResponse,
        messages=[{"role": "user", "content": f"Analyze the plot thread: {thread.name}"}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/characters/{character_id}/analyze-arc", response_model=StructuredResult)
async def analyze_character_arc_structured(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Structured AI analysis of a character's arc: trajectory, drift, health, moment discoveries."""
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    story = db.query(Story).filter(Story.id == character.story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Character not found")

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == character.story_id).all()

    # Ordered leaf nodes
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    scenes = []
    name_lower = character.name.lower()
    for n in leaves:
        if n.content and name_lower in n.content.lower():
            scenes.append(
                {
                    "id": n.id,
                    "title": n.title or "Untitled",
                    "content_excerpt": n.content,
                }
            )

    story_context = story.logline or story.premise or story.narrative_intent or ""

    feature_prompt = build_arc_analysis_prompt(
        character=character,
        story_title=story.title,
        story_context=story_context,
        scenes=scenes,
    )

    ctx = AICallContext(
        feature="arc-analysis",
        user_id=current_user.id,
        story_id=story.id,
        character_id=character_id,
        tags=["character", "analysis", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=ArcAnalysisResponse,
        messages=[{"role": "user", "content": f"Analyze {character.name}'s arc."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/analyze/essential-questions", response_model=StructuredResult)
async def analyze_essential_questions(
    story_id: str,
    character_id: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assess whether the 6 Essential Questions are answerable for a protagonist."""
    story = _get_story(story_id, db, current_user)

    # Resolve character: explicit → POV character → first protagonist
    character = None
    if character_id:
        character = db.get(Character, character_id)
        if not character or character.story_id != story_id:
            raise HTTPException(status_code=404, detail="Character not found")
    if not character and story.pov_character_id:
        character = db.get(Character, story.pov_character_id)
    if not character:
        character = db.query(Character).filter(Character.story_id == story_id, Character.role == "protagonist").first()
    if not character:
        character = db.query(Character).filter(Character.story_id == story_id).first()
    if not character:
        raise HTTPException(status_code=422, detail="No characters found for this story")

    # Gather scenes featuring this character
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    name_lower = character.name.lower()
    relevant_scenes = [f"[{n.title}]\n{n.content}" for n in all_nodes if n.content and name_lower in n.content.lower()]
    scenes_content = "\n\n".join(relevant_scenes) if relevant_scenes else ""

    feature_prompt = build_essential_questions_prompt(
        character=character,
        story=story,
        scenes_content=scenes_content,
    )

    ctx = AICallContext(
        feature="essential-questions",
        user_id=current_user.id,
        story_id=story_id,
        character_id=character.id,
        tags=["story", "character", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=EssentialQuestionsResponse,
        messages=[
            {
                "role": "user",
                "content": f"Assess the 6 essential questions for {character.name}.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Story Compass: essential questions for {character.name}",
        metadata_={
            "feature": "essential-questions",
            "character_id": character.id,
            "character_name": character.name,
            "result": result.model_dump() if hasattr(result, "model_dump") else result,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/show-dont-tell", response_model=StructuredResult)
async def analyze_show_dont_tell(
    story_id: str,
    node_id: str | None = Body(None, embed=True),
    text: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze prose for 'show don't tell' opportunities."""
    story = _get_story(story_id, db, current_user)

    # Resolve prose text
    if text:
        prose_text = text.strip()
    elif node_id:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
        prose_text = (node.content or "").strip()
    else:
        raise HTTPException(status_code=422, detail="Either node_id or text must be provided")

    if not prose_text:
        raise HTTPException(status_code=422, detail="No prose content to analyze")

    feature_prompt = build_show_dont_tell_prompt(
        prose_text=prose_text,
        story_title=story.title,
        genre=story.genre or None,
        tone=story.tone or None,
    )

    ctx = AICallContext(
        feature="show-dont-tell",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "analysis", "craft", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=ShowDontTellAnalysisResponse,
        messages=[{"role": "user", "content": "Analyze this prose for show don't tell."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/analyze/audience-adherence", response_model=StructuredResult)
async def analyze_audience_adherence(
    story_id: str,
    node_id: str | None = Body(None, embed=True),
    text: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze how well prose matches its declared target audience."""
    story = _get_story(story_id, db, current_user)

    if not story.target_audience:
        raise HTTPException(
            status_code=422,
            detail="No target audience set. Add one in the Lorebook before running this analysis.",
        )

    if story.target_audience not in TARGET_AUDIENCES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown target audience '{story.target_audience}'. Set a valid audience in the Lorebook.",
        )

    # Resolve prose text
    if text:
        prose_text = text.strip()
    elif node_id:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
        prose_text = (node.content or "").strip()
    else:
        raise HTTPException(status_code=422, detail="Either node_id or text must be provided")

    if not prose_text:
        raise HTTPException(status_code=422, detail="No prose content to analyze")

    feature_prompt = build_audience_adherence_prompt(
        prose_text=prose_text,
        story_title=story.title,
        target_audience=story.target_audience,
    )

    ctx = AICallContext(
        feature="audience-adherence",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "analysis", "craft", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=AudienceAdherenceResponse,
        messages=[{"role": "user", "content": "Analyze this prose for target audience fit."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


# ── NLP Prose Analysis (spaCy — no LLM) ──────────────────────────────────────


@router.post("/stories/{story_id}/analyze/prose-nlp", response_model=ProseNLPResponse)
def analyze_prose_nlp(
    story_id: str,
    node_ids: list[str] | None = Body(None, embed=True),
    checks: list[str] | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run spaCy NLP analysis on one or more scenes.

    No LLM involved — all analysis is local and deterministic.
    node_ids=null runs all scenes; checks=null runs all checks.
    """
    _get_story(story_id, db, current_user)
    result = run_prose_analysis(story_id, current_user.id, db, node_ids, checks)
    db.commit()
    return result


@router.post(
    "/stories/{story_id}/analyze/entity-suggestions",
    response_model=EntitySuggestionsResponse,
)
def analyze_entity_suggestions(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run NER across all scenes to surface proper nouns not in the Lorebook.
    Returns character (PERSON) and location (GPE/LOC) suggestions.
    """
    _get_story(story_id, db, current_user)
    result = run_entity_scan(story_id, current_user.id, db)
    db.commit()
    return result


# ── Editorial Consistency (NLP — no LLM) ─────────────────────────────────────


@router.post(
    "/stories/{story_id}/analyze/editorial-consistency",
    response_model=EditorialConsistencyResponse,
)
def analyze_editorial_consistency(
    story_id: str,
    node_ids: list[str] | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run tense consistency and POV drift detection across scenes.

    No LLM involved — all analysis is local and deterministic.
    node_ids=null runs all scenes.
    """
    _get_story(story_id, db, current_user)
    result = run_editorial_consistency(story_id, current_user.id, db, node_ids)
    db.commit()
    return result


# ── AI Story Analyses ─────────────────────────────────────────────────────────


@router.post("/stories/{story_id}/analyze/pacing", response_model=StructuredResult)
async def analyze_pacing(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze pacing, act balance, and tension curve using AI."""
    story = _get_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        leaves = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                leaves.append(n)
            else:
                leaves.extend(flatten_leaves(kids))
        return leaves

    leaves = flatten_leaves(roots)
    total_words = sum(n.word_count for n in all_nodes)

    # Build parent label map for scene context
    parent_map: dict[str, str] = {}
    for n in all_nodes:
        if n.parent_id:
            parent = next((x for x in all_nodes if x.id == n.parent_id), None)
            if parent:
                parent_map[n.id] = parent.title or parent.level_type or ""

    scenes_info = []
    for leaf in leaves:
        parent_label = f" [{parent_map[leaf.id]}]" if leaf.id in parent_map else ""
        scenes_info.append(f'- "{leaf.title or "Untitled"}"{parent_label} ({leaf.word_count} words, {leaf.status})')

    feature_prompt = build_pacing_analysis_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        intended_length=story.intended_length,
        scenes_info=scenes_info,
        total_words=total_words,
    )

    ctx = AICallContext(
        feature="pacing-analysis",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=PacingAnalysisResponse,
        messages=[{"role": "user", "content": "Analyze this story's pacing."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    issue_count = len(result.data.get("slow_spots", [])) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Pacing analysis: {issue_count} slow spot(s) identified",
        metadata_={
            "feature": "pacing-analysis",
            "result": result.model_dump(),
            "issue_count": issue_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/continuity", response_model=StructuredResult)
async def analyze_continuity(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check for continuity issues and inconsistencies across scenes using AI."""
    story = _get_story(story_id, db, current_user)

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    characters_summary = []
    for c in characters:
        parts = [f"- {c.name} ({c.role})"]
        if c.motivation:
            parts.append(f"  Motivation: {c.motivation}")
        characters_summary.append("\n".join(parts))

    scenes_with_content = []
    for leaf in leaves:
        if leaf.content and leaf.content.strip():
            excerpt = leaf.content[:600]
            scenes_with_content.append(
                f"[{leaf.title or 'Untitled'}]\n{excerpt}{'...' if len(leaf.content) > 600 else ''}"
            )

    feature_prompt = build_continuity_check_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        characters_summary=characters_summary,
        scenes_with_content=scenes_with_content,
    )

    ctx = AICallContext(
        feature="continuity-check",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=ContinuityCheckResponse,
        messages=[{"role": "user", "content": "Check this story for continuity issues."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    issue_count = len(result.data.get("issues", [])) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Continuity check: {issue_count} issue(s) found",
        metadata_={
            "feature": "continuity-check",
            "result": result.model_dump(),
            "issue_count": issue_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/themes", response_model=StructuredResult)
async def analyze_themes(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Identify recurring themes, motifs, and thematic development using AI."""
    story = _get_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    scenes_with_content = []
    for leaf in leaves:
        if leaf.content and leaf.content.strip():
            excerpt = leaf.content[:500]
            scenes_with_content.append(
                f"[{leaf.title or 'Untitled'}]\n{excerpt}{'...' if len(leaf.content) > 500 else ''}"
            )

    feature_prompt = build_theme_tracker_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        story_themes=story.themes or [],
        scenes_with_content=scenes_with_content,
    )

    ctx = AICallContext(
        feature="theme-tracker",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=ThemeTrackerResponse,
        messages=[{"role": "user", "content": "Identify themes and motifs in this story."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    theme_count = len(result.data.get("themes", [])) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Theme tracker: {theme_count} theme(s) identified",
        metadata_={
            "feature": "theme-tracker",
            "result": result.model_dump(),
            "theme_count": theme_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/plot-holes", response_model=StructuredResult)
async def analyze_plot_holes(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detect logical gaps and plot holes across scenes using AI."""
    story = _get_story(story_id, db, current_user)

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    characters_summary = [f"- {c.name} ({c.role})" + (f": {c.motivation}" if c.motivation else "") for c in characters]
    threads_summary = [f'- "{t.name}" [{t.mice_type or "untyped"}] status: {t.status}' for t in threads]
    scenes_with_content = []
    for leaf in leaves:
        if leaf.content and leaf.content.strip():
            excerpt = leaf.content[:500]
            scenes_with_content.append(
                f"[{leaf.title or 'Untitled'}]\n{excerpt}{'...' if len(leaf.content) > 500 else ''}"
            )

    feature_prompt = build_plot_hole_detection_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent,
        characters_summary=characters_summary,
        threads_summary=threads_summary,
        scenes_with_content=scenes_with_content,
    )

    ctx = AICallContext(
        feature="plot-holes",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=PlotHoleDetectionResponse,
        messages=[{"role": "user", "content": "Detect plot holes in this story."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    hole_count = len(result.data.get("holes", [])) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Plot hole detection: {hole_count} hole(s) found",
        metadata_={
            "feature": "plot-holes",
            "result": result.model_dump(),
            "hole_count": hole_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/first-pass", response_model=StructuredResult)
async def analyze_first_pass(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    First-pass editor: compare the written story against the author's stated intent,
    goals, and character arc milestones. Surfaces intent-vs-prose gaps.
    """
    story = _get_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)
    total_words = sum(n.word_count or 0 for n in all_nodes)

    scenes_info = []
    for leaf in leaves:
        synopsis = (
            leaf.synopsis.strip() if leaf.synopsis else leaf.content_summary.strip() if leaf.content_summary else ""
        )
        desc = f": {synopsis[:120]}" if synopsis else ""
        scenes_info.append(
            f'- "{leaf.title or "Untitled"}" ({leaf.word_count or 0} words, {leaf.status or "draft"}){desc}'
        )

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    characters_summary = []
    for c in characters:
        parts = [f"- {c.name} ({c.role})"]
        if getattr(c, "narrative_intent", None):
            parts.append(f"  Arc plan: {c.narrative_intent}")
        milestones = getattr(c, "arc_milestones", None) or []
        pending = [m.get("text", "") for m in milestones if not m.get("completed")]
        if pending:
            parts.append(f"  Pending milestones: {', '.join(pending[:3])}")
        characters_summary.append("\n".join(parts))

    # Story goals checklist (Story.goals is a JSON list of {id, text, completed})
    story_goals = [g.get("text", "") for g in (story.goals or []) if isinstance(g, dict) and g.get("text")]

    feature_prompt = build_first_pass_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent or None,
        story_goals=story_goals,
        genre=story.genre or None,
        tone=story.tone or None,
        characters_summary=characters_summary,
        scenes_info=scenes_info,
        total_words=total_words,
    )

    ctx = AICallContext(
        feature="first-pass",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "intent", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=FirstPassAnalysisResponse,
        messages=[
            {
                "role": "user",
                "content": "Perform a first-pass editorial review comparing this story against its stated intent.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    gap_count = len(result.data.get("gaps", [])) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"First-pass editor: {gap_count} intent gap(s) found",
        metadata_={
            "feature": "first-pass",
            "result": result.model_dump(),
            "gap_count": gap_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/cliches", response_model=StructuredResult)
async def analyze_cliches(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan all scenes for clichéd language, tropes, and overused patterns."""
    story = _get_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    scenes = []
    total_words = 0
    for leaf in leaves:
        if leaf.content and leaf.content.strip():
            total_words += len(leaf.content.split())
            scenes.append(
                {
                    "id": leaf.id,
                    "title": leaf.title or "Untitled",
                    "content": leaf.content,
                }
            )

    if not scenes:
        raise HTTPException(status_code=422, detail="No scene content to analyze")

    feature_prompt = build_cliche_analysis_prompt(
        story_title=story.title,
        genre=story.genre or None,
        tone=story.tone or None,
        scenes=scenes,
        total_words=total_words,
    )

    ctx = AICallContext(
        feature="cliche-analysis",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "analysis", "craft", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=ClicheAnalysisResponse,
        messages=[
            {
                "role": "user",
                "content": "Identify clichéd language and patterns in this story.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    cliche_count = result.data.get("total_count", 0) if result.success and result.data else 0
    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Cliche check: {cliche_count} cliché(s) found",
        metadata_={
            "feature": "cliche-analysis",
            "result": result.model_dump(),
            "cliche_count": cliche_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/chat/cliche-coach")
async def cliche_coach_chat(
    story_id: str,
    node_id: str = Body(...),
    messages: list[dict] = Body(...),
    selected_text: str | None = Body(None),
    llm_params=Body(None),
    mentioned_refs: list[MentionedRef] = Body([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a cliche coaching response for selected prose."""
    from ..schemas.llm_params import LLMParamsOverride
    from ..services.codex.mentions import render_mentions, resolve_mentions

    if llm_params and not isinstance(llm_params, LLMParamsOverride):
        llm_params = LLMParamsOverride(**llm_params)

    story = _get_story(story_id, db, current_user)
    node = db.get(StructureNode, node_id) if node_id not in {"__global__", "__story__"} else None
    if node_id not in {"__global__", "__story__"} and (not node or node.story_id != story_id):
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_title = node.title if node else "General"
    passage = selected_text or (node.content[:500] if node and node.content else "")

    feature_prompt = build_cliche_coach_system_prompt(
        story_title=story.title,
        scene_title=scene_title,
        genre=story.genre or None,
        selected_text=passage,
    ) + render_mentions(resolve_mentions(story_id, mentioned_refs, db))

    call_ctx = AICallContext(
        feature="cliche-coach",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "chat", "craft", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=messages,
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
        llm_params=llm_params,
    )


@router.post("/stories/{story_id}/discovery-questions", response_model=StructuredResult)
async def generate_discovery_questions(  # noqa: C901, PLR0912
    story_id: str,
    focus_area: str = Body(...),  # "character" | "location" | "scene" | "story"
    entity_id: str | None = Body(None),  # character_id, location_id, or node_id
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate thought-provoking discovery questions for a story element."""
    story = _get_story(story_id, db, current_user)

    if focus_area not in {"character", "location", "scene", "story"}:
        raise HTTPException(
            status_code=422,
            detail="focus_area must be character, location, scene, or story",
        )

    story_context = {
        "title": story.title,
        "genre": story.genre or "",
        "tone": story.tone or "",
    }

    # Build entity_data based on focus_area
    if focus_area == "character":
        if not entity_id:
            # Fall back to POV character or first character
            character = None
            if story.pov_character_id:
                character = db.get(Character, story.pov_character_id)
            if not character:
                character = db.query(Character).filter(Character.story_id == story_id).first()
            if not character:
                raise HTTPException(status_code=422, detail="No characters found for this story")
        else:
            character = db.get(Character, entity_id)
            if not character or character.story_id != story_id:
                raise HTTPException(status_code=404, detail="Character not found")
        entity_data = {
            "name": character.name,
            "role": character.role or "",
            "mission_statement": character.mission_statement or "",
            "personality": character.personality or "",
            "motivation": character.motivation or "",
            "background": character.background or "",
            "appearance": character.appearance or "",
            "arc_notes": character.arc_notes or "",
            "narrative_intent": character.narrative_intent or "",
            "traits": character.traits or {},
        }

    elif focus_area == "location":
        if not entity_id:
            location = db.query(Location).filter(Location.story_id == story_id).first()
            if not location:
                raise HTTPException(status_code=422, detail="No locations found for this story")
        else:
            location = db.get(Location, entity_id)
            if not location or location.story_id != story_id:
                raise HTTPException(status_code=404, detail="Location not found")
        entity_data = {
            "name": location.name,
            "location_type": location.location_type or "",
            "climate": location.climate or "",
            "terrain": location.terrain or "",
            "description": location.description or "",
            "atmosphere": location.atmosphere or "",
            "history": location.history or "",
            "significance": location.significance or "",
            "political_affiliation": location.political_affiliation or "",
        }

    elif focus_area == "scene":
        if not entity_id:
            raise HTTPException(status_code=422, detail="entity_id required for scene focus")
        node = db.get(StructureNode, entity_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
        pov_char_name = ""
        if node.pov_character_id:
            pov_char = db.get(Character, node.pov_character_id)
            if pov_char:
                pov_char_name = pov_char.name
        entity_data = {
            "title": node.title or "Untitled",
            "synopsis": node.synopsis or "",
            "entry_state": node.entry_state or "",
            "exit_state": node.exit_state or "",
            "key_events": node.key_events or [],
            "pov_character": pov_char_name,
            "status": node.status or "",
        }

    else:  # story
        entity_data = {
            "title": story.title,
            "genre": story.genre or "",
            "tone": story.tone or "",
            "themes": story.themes or [],
            "central_conflict": story.central_conflict or "",
            "logline": story.logline or "",
            "premise": story.premise or "",
            "narrative_intent": story.narrative_intent or story.intent or "",
        }

    feature_prompt = build_discovery_questions_prompt(
        focus_area=focus_area,
        entity_data=entity_data,
        story_context=story_context,
    )

    ctx = AICallContext(
        feature="discovery-questions",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "discovery", "craft", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=DiscoveryQuestionsResponse,
        messages=[
            {
                "role": "user",
                "content": f"Generate discovery questions for this {focus_area}.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


# ── Character Dimensionality ─────────────────────────────────────────────────


def _gather_character_data(character: Character, db: Session, all_nodes: list | None = None) -> dict:
    """Build a character data dict suitable for the dimensionality prompt."""
    # Relationships
    rels = db.query(CharacterRelationship).filter(CharacterRelationship.character_id == character.id).all()
    # Resolve related character names
    rel_char_ids = [r.related_character_id for r in rels]
    rel_chars = (
        {c.id: c.name for c in db.query(Character).filter(Character.id.in_(rel_char_ids)).all()} if rel_char_ids else {}
    )
    relationships = [
        {
            "other_name": rel_chars.get(r.related_character_id, "Unknown"),
            "relationship_type": r.relationship_type,
            "description": r.description or "",
        }
        for r in rels
    ]

    # Scene count
    scene_count = 0
    if all_nodes:
        name_lower = character.name.lower()
        scene_count = sum(1 for n in all_nodes if n.content and name_lower in n.content.lower())

    return {
        "id": character.id,
        "name": character.name,
        "role": character.role or "",
        "personality": character.personality or "",
        "motivation": character.motivation or "",
        "background": character.background or "",
        "appearance": character.appearance or "",
        "arc_notes": character.arc_notes or "",
        "narrative_intent": character.narrative_intent or "",
        "mission_statement": character.mission_statement or "",
        "conflict": character.conflict or "",
        "epiphany": character.epiphany or "",
        "arc_in_own_words": character.arc_in_own_words or "",
        "traits": character.traits or {},
        "arc_milestones": character.arc_milestones or [],
        "relationships": relationships,
        "scene_count": scene_count,
    }


@router.post("/characters/{character_id}/assess-dimensionality", response_model=StructuredResult)
async def assess_character_dimensionality(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assess dimensionality of a single character — depth, contradictions, relationship complexity."""
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    story = db.query(Story).filter(Story.id == character.story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Character not found")

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()
    char_data = _gather_character_data(character, db, all_nodes)

    feature_prompt = build_character_dimensionality_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or story.intent if hasattr(story, "intent") else story.narrative_intent,
        characters_data=[char_data],
        single_character=True,
    )

    ctx = AICallContext(
        feature="character-dimensionality",
        user_id=current_user.id,
        story_id=story.id,
        character_id=character_id,
        tags=["character", "dimensionality", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=CharacterDimensionalityResponse,
        messages=[
            {
                "role": "user",
                "content": f"Assess the dimensionality of {character.name}.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post(
    "/stories/{story_id}/analyze/character-dimensionality",
    response_model=StructuredResult,
)
async def analyze_all_character_dimensionality(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assess dimensionality across all characters in the story for the Story Health view."""
    story = _get_story(story_id, db, current_user)
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    if not characters:
        raise HTTPException(status_code=400, detail="No characters found in this story")

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()

    # Summarized data per character — include relationship/milestone counts for efficiency
    characters_data = []
    for c in characters:
        rels = db.query(CharacterRelationship).filter(CharacterRelationship.character_id == c.id).all()
        name_lower = c.name.lower()
        scene_count = sum(1 for n in all_nodes if n.content and name_lower in n.content.lower())
        characters_data.append(
            {
                "id": c.id,
                "name": c.name,
                "role": c.role or "",
                "personality": (c.personality or "")[:200],
                "motivation": (c.motivation or "")[:200],
                "background": (c.background or "")[:200],
                "arc_notes": (c.arc_notes or "")[:200],
                "narrative_intent": (c.narrative_intent or "")[:150],
                "mission_statement": c.mission_statement or "",
                "traits": c.traits or {},
                "relationship_count": len(rels),
                "milestone_count": len(c.arc_milestones or []),
                "scene_count": scene_count,
            }
        )

    feature_prompt = build_character_dimensionality_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent,
        characters_data=characters_data,
        single_character=False,
    )

    ctx = AICallContext(
        feature="character-dimensionality",
        user_id=current_user.id,
        story_id=story_id,
        tags=["character", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=CharacterDimensionalityResponse,
        messages=[
            {
                "role": "user",
                "content": "Assess character dimensionality across the cast.",
            }
        ],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Character depth: {count(len(characters), 'character')} assessed",
        metadata_={
            "feature": "character-dimensionality",
            "result": result.model_dump() if hasattr(result, "model_dump") else result,
            "character_count": len(characters),
        },
    )
    db.add(log)
    db.commit()

    return result


# ── Batch Scene Summary Generation ───────────────────────────────────────────


class BatchSummarizeRequest(BaseModel):
    up_to_node_id: str | None = None  # Only summarize scenes up to this node (inclusive)
    force_refresh: bool = False  # Re-summarize even scenes that are already fresh


class BatchSummarizeResponse(BaseModel):
    total_scenes: int
    summarized_count: int
    skipped_count: int
    failed_count: int


@router.post("/stories/{story_id}/summarize-batch", response_model=BatchSummarizeResponse)
async def summarize_scenes_batch(
    story_id: str,
    body: BatchSummarizeRequest = Body(default=BatchSummarizeRequest()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate AI summaries for all scenes with stale or missing summaries.

    Runs inline and holds the request open. For a whole manuscript, queue it instead
    (POST /stories/{id}/jobs/scene-summaries), which reports progress and can be stopped.
    """
    _get_story(story_id, db, current_user)
    counts = await refresh_scene_summaries(
        story_id,
        db,
        current_user,
        force_refresh=body.force_refresh,
        up_to_node_id=body.up_to_node_id,
    )
    return BatchSummarizeResponse(
        total_scenes=counts["total_scenes"],
        summarized_count=counts["summarized_count"],
        skipped_count=counts["skipped_count"],
        failed_count=counts["failed_count"],
    )


#: Features whose activity rows are shown on the Story Health page.
HEALTH_FEATURES = {
    "prose-analysis",
    "entity-suggestions",
    "economy-analysis",
    "essential-questions",
    "editorial-consistency",
    "pacing-analysis",
    "continuity-check",
    "theme-tracker",
    "plot-holes",
    "first-pass",
    "cliche-analysis",
    "character-dimensionality",
    "scene-summary-batch",
    "voice-fidelity",
}


@router.get("/stories/{story_id}/analysis/latest", response_model=ActivityLogOut | None)
def get_latest_analysis(
    story_id: str,
    feature: str = Query(..., description="Feature key, e.g. prose-analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent analysis_run log for a given feature, or null."""
    _get_story(story_id, db, current_user)
    if feature not in HEALTH_FEATURES:
        raise HTTPException(status_code=400, detail=f"Unknown feature: {feature}")
    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.story_id == story_id,
            ActivityLog.user_id == current_user.id,
            ActivityLog.event_type == "analysis_run",
        )
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    for log in logs:
        if log.metadata_.get("feature") == feature:
            return log
    return None
