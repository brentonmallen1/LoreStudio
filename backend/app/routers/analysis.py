from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

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
    build_economy_analysis_prompt,
    build_session_recap_prompt,
)
from ..models.plot_thread import PlotThread
from ..models.activity_log import ActivityLog
from ..models.interview import CharacterInterview
from ..services.word_count import WORD_COUNT_RANGES
from ..schemas.ai_responses import EconomyAnalysisResponse, StructuredResult

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

    return await ai_gateway.generate_structured(
        response_model=EconomyAnalysisResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


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
