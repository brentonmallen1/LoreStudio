from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.summaries import build_structure_section_summary_prompt
from ..services.llm.prompts.analysis import (
    build_character_arc_prompt,
    build_thread_analysis_prompt,
    build_arc_analysis_prompt,
    build_economy_analysis_prompt,
    build_session_recap_prompt,
    build_essential_questions_prompt,
    build_show_dont_tell_prompt,
    build_audience_adherence_prompt,
    build_pacing_analysis_prompt,
    build_continuity_check_prompt,
    build_theme_tracker_prompt,
    build_plot_hole_detection_prompt,
    build_first_pass_prompt,
    TARGET_AUDIENCES,
)
from ..models.plot_thread import PlotThread
from ..models.activity_log import ActivityLog
from ..models.interview import CharacterInterview
from ..services.word_count import WORD_COUNT_RANGES
from ..schemas.ai_responses import (
    EconomyAnalysisResponse,
    ThreadAnalysisResponse,
    ArcAnalysisResponse,
    EssentialQuestionsResponse,
    ShowDontTellAnalysisResponse,
    AudienceAdherenceResponse,
    PacingAnalysisResponse,
    ContinuityCheckResponse,
    ThemeTrackerResponse,
    PlotHoleDetectionResponse,
    FirstPassAnalysisResponse,
    StructuredResult,
)
from ..schemas.nlp_analysis import (
    ProseNLPResponse, SceneNLPAnalysis, EntitySuggestionsResponse,
    SceneEditorialAnalysis, EditorialConsistencyResponse,
)
from ..schemas.chronicle import ActivityLogOut
from ..services.nlp_analysis_service import analyze_scene, extract_unknown_entities, ALL_CHECKS, analyze_scene_editorial
from ..models.location import Location

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

    # Gather this node and all children recursively
    def gather_content(n: StructureNode) -> list[str]:
        pieces = []
        if n.content and n.content.strip():
            pieces.append(f"[{n.title}]\n{n.content}")
        for child in sorted(n.children, key=lambda c: c.position):
            pieces.extend(gather_content(child))
        return pieces

    content_pieces = gather_content(node)
    if not content_pieces:
        async def no_content():
            yield f"'{node.title}' has no written content yet."
        return StreamingResponse(no_content(), media_type="text/plain")

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

    async def stream():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
        ):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


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
        f"[{n.title}]\n{n.content}"
        for n in all_nodes
        if n.content and character.name.lower() in n.content.lower()
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

    async def stream():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
        ):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


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
            f"- \"{t.name}\" [{t.mice_type or 'untyped'}] — status: {t.status}, "
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
            f"- \"{leaf.title or 'Untitled'}\" ({leaf.word_count} words, {leaf.status})"
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
        description=f"Economy analysis completed",
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
        activity_text = "\n".join(
            f"- {log.event_type}: {log.description}" for log in recent_logs
        )

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
                + (f': {notes_snippet}' if notes_snippet else '')
            )
        interviews_text = "\n".join(lines)

    # ── Nothing to recap ──
    if not recent_scenes and not recent_logs and not recent_interviews:
        async def empty_stream():
            yield "Nothing to recap yet — no scenes, activity, or interviews recorded for this story."
        return StreamingResponse(empty_stream(), media_type="text/plain")

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

    async def recap_stream():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
        ):
            yield token

    return StreamingResponse(recap_stream(), media_type="text/plain")


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
            scenes.append({
                "id": n.id,
                "title": n.title or "Untitled",
                "content_excerpt": n.content,
            })

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
            scenes.append({
                "id": n.id,
                "title": n.title or "Untitled",
                "content_excerpt": n.content,
            })

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
        character = (
            db.query(Character)
            .filter(Character.story_id == story_id, Character.role == "protagonist")
            .first()
        )
    if not character:
        character = db.query(Character).filter(Character.story_id == story_id).first()
    if not character:
        raise HTTPException(status_code=422, detail="No characters found for this story")

    # Gather scenes featuring this character
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    name_lower = character.name.lower()
    relevant_scenes = [
        f"[{n.title}]\n{n.content}"
        for n in all_nodes
        if n.content and name_lower in n.content.lower()
    ]
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
        messages=[{"role": "user", "content": f"Assess the 6 essential questions for {character.name}."}],
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
    story = _get_story(story_id, db, current_user)

    if node_ids:
        nodes = db.query(StructureNode).filter(StructureNode.id.in_(node_ids)).all()
    else:
        nodes = (
            db.query(StructureNode)
            .filter(
                StructureNode.story_id == story_id,
                StructureNode.content.isnot(None),
                StructureNode.content != "",
            )
            .all()
        )

    checks_set = set(checks) & ALL_CHECKS if checks else ALL_CHECKS

    scenes: list[SceneNLPAnalysis] = []
    for node in nodes:
        if not node.content or not node.content.strip():
            continue
        analysis = analyze_scene(node.content, checks_set)
        scenes.append(SceneNLPAnalysis(
            scene_id=node.id,
            scene_title=node.title or "",
            **analysis,
        ))

    result = ProseNLPResponse(
        scenes=scenes,
        checks_run=sorted(checks_set),
    )

    # Count findings across all scenes for the summary
    warning_count = 0
    for s in scenes:
        for check in checks_set:
            analysis_obj = getattr(s, check, None)
            if analysis_obj and hasattr(analysis_obj, "findings"):
                warning_count += sum(
                    1 for f in (analysis_obj.findings or [])
                    if f.severity in ("warning", "issue")
                )

    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Prose analysis: {len(scenes)} scene(s), {warning_count} warning(s)",
        metadata_={
            "feature": "prose-analysis",
            "result": result.model_dump(),
            "scene_count": len(scenes),
            "warning_count": warning_count,
        },
    )
    db.add(log)
    db.commit()
    return result


@router.post("/stories/{story_id}/analyze/entity-suggestions", response_model=EntitySuggestionsResponse)
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

    # Gather known entities from Lorebook
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    locations = db.query(Location).filter(Location.story_id == story_id).all()
    known_characters = {c.name for c in characters}
    known_locations = {l.name for l in locations}

    # Gather all scene content
    nodes = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id == story_id,
            StructureNode.content.isnot(None),
            StructureNode.content != "",
        )
        .all()
    )

    scene_tuples = [
        (n.id, n.title or "", n.content)
        for n in nodes
        if n.content and n.content.strip()
    ]

    result = extract_unknown_entities(scene_tuples, known_characters, known_locations)
    char_count = len(result.character_suggestions)
    loc_count = len(result.location_suggestions)

    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Entity scan: {char_count} character(s), {loc_count} location(s) found",
        metadata_={
            "feature": "entity-suggestions",
            "result": result.model_dump(),
            "character_count": char_count,
            "location_count": loc_count,
        },
    )
    db.add(log)
    db.commit()
    return result

# ── Editorial Consistency (NLP — no LLM) ─────────────────────────────────────

@router.post("/stories/{story_id}/analyze/editorial-consistency", response_model=EditorialConsistencyResponse)
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

    if node_ids:
        nodes = db.query(StructureNode).filter(StructureNode.id.in_(node_ids)).all()
    else:
        nodes = (
            db.query(StructureNode)
            .filter(
                StructureNode.story_id == story_id,
                StructureNode.content.isnot(None),
                StructureNode.content != "",
            )
            .all()
        )

    scenes: list[SceneEditorialAnalysis] = []
    for node in nodes:
        if not node.content or not node.content.strip():
            continue
        analysis = analyze_scene_editorial(node.content)
        scenes.append(SceneEditorialAnalysis(
            scene_id=node.id,
            scene_title=node.title or "",
            **analysis,
        ))

    total_tense = sum(
        (s.tense_consistency.shift_count if s.tense_consistency else 0)
        for s in scenes
    )
    total_pov = sum(
        len(s.pov_drift.findings) if s.pov_drift else 0
        for s in scenes
    )

    result = EditorialConsistencyResponse(
        scenes=scenes,
        checks_run=["tense_consistency", "pov_drift"],
        total_tense_shifts=total_tense,
        total_pov_flags=total_pov,
    )

    log = ActivityLog(
        user_id=current_user.id,
        story_id=story_id,
        event_type="analysis_run",
        category="health",
        description=f"Editorial consistency: {len(scenes)} scene(s), {total_tense} tense shift(s), {total_pov} POV flag(s)",
        metadata_={
            "feature": "editorial-consistency",
            "result": result.model_dump(),
            "scene_count": len(scenes),
            "tense_shift_count": total_tense,
            "pov_flag_count": total_pov,
        },
    )
    db.add(log)
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
        scenes_info.append(
            f'- "{leaf.title or "Untitled"}"{parent_label} ({leaf.word_count} words, {leaf.status})'
        )

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
                f'[{leaf.title or "Untitled"}]\n{excerpt}{"..." if len(leaf.content) > 600 else ""}'
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
                f'[{leaf.title or "Untitled"}]\n{excerpt}{"..." if len(leaf.content) > 500 else ""}'
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
    threads_summary = [
        f'- "{t.name}" [{t.mice_type or "untyped"}] status: {t.status}'
        for t in threads
    ]
    scenes_with_content = []
    for leaf in leaves:
        if leaf.content and leaf.content.strip():
            excerpt = leaf.content[:500]
            scenes_with_content.append(
                f'[{leaf.title or "Untitled"}]\n{excerpt}{"..." if len(leaf.content) > 500 else ""}'
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
        synopsis = leaf.synopsis.strip() if leaf.synopsis else leaf.content_summary.strip() if leaf.content_summary else ""
        desc = f": {synopsis[:120]}" if synopsis else ""
        scenes_info.append(f'- "{leaf.title or "Untitled"}" ({leaf.word_count or 0} words, {leaf.status or "draft"}){desc}')

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

    # Story goals from metadata
    story_goals = []
    if story.metadata_ and isinstance(story.metadata_, dict):
        goals_raw = story.metadata_.get("story_goals", [])
        story_goals = [g.get("text", "") for g in goals_raw if isinstance(g, dict) and g.get("text")]

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
        messages=[{"role": "user", "content": "Perform a first-pass editorial review comparing this story against its stated intent."}],
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


# ── Analysis History Endpoints ────────────────────────────────────────────────

HEALTH_FEATURES = {
    "prose-analysis", "entity-suggestions", "economy-analysis", "essential-questions",
    "editorial-consistency", "pacing-analysis", "continuity-check", "theme-tracker", "plot-holes",
    "first-pass",
}


@router.get("/stories/{story_id}/analysis/latest", response_model=Optional[ActivityLogOut])
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


@router.get("/stories/{story_id}/analysis/history", response_model=list[ActivityLogOut])
def get_analysis_history(
    story_id: str,
    features: Optional[str] = Query(None, description="Comma-separated feature keys"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return analysis_run logs for a story, optionally filtered by feature."""
    _get_story(story_id, db, current_user)
    feature_set = None
    if features:
        feature_set = {f.strip() for f in features.split(",") if f.strip() in HEALTH_FEATURES}

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.story_id == story_id,
            ActivityLog.user_id == current_user.id,
            ActivityLog.event_type == "analysis_run",
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(200)
        .all()
    )
    if feature_set:
        logs = [l for l in logs if l.metadata_.get("feature") in feature_set]
    return logs[:limit]
