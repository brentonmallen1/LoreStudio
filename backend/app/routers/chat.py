"""
Scene-aware chat assistant.

Assembles a rich context packet from everything the story knows about the current
scene, then streams a response.  Context includes:

  - Lorebook: title, genre, tone, themes, narrative intent, logline, premise
  - Active scene: title, synopsis, purpose, entry/exit state, key events, prose (truncated)
  - Characters @mentioned in the scene's prose (full profiles)
  - Plot threads touching this scene
  - Settings [[mentioned]] in the prose
  - Recent sibling scenes (titles + synopses) for narrative flow awareness
  - Author's unresolved goals

A /context endpoint (GET) returns the assembled context packet so the frontend
can show the author exactly what the AI is seeing.
"""

import re
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..models.setting import Setting
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.chat import build_scene_chat_system_prompt, build_writing_coach_system_prompt
from ..schemas.llm_params import LLMParams

router = APIRouter()


class ContextOptions(BaseModel):
    """Controls which context sections are included in the LLM prompt."""
    include_characters: bool = True
    include_threads: bool = True
    include_settings: bool = True
    include_siblings: bool = True

# How many characters of prose to include in context (keep tokens reasonable)
PROSE_CONTEXT_LIMIT = 2000


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _extract_mentions(content: str) -> tuple[list[str], list[str]]:
    """Return (character_names, setting_names) mentioned in prose."""
    char_names = re.findall(r"@([\w\s'-]+?)(?=\s|[,.:;!?@\[\]]|$)", content)
    setting_names = re.findall(r"\[\[([\w\s'-]+?)\]\]", content)
    return [n.strip() for n in char_names], [n.strip() for n in setting_names]


VIRTUAL_NODE_IDS = {"__global__", "__story__"}


def _build_context_packet(story: Story, node: StructureNode | None, db: Session, context_options: ContextOptions | None = None) -> dict:
    """Assemble the full context dict — used for both the preview endpoint and chat."""

    # ── Lorebook ──
    # Resolve POV character name if set
    pov_char_name: str | None = None
    if story.pov_character_id:
        from ..models.character import Character as CharacterModel
        pov_char = db.get(CharacterModel, story.pov_character_id)
        if pov_char:
            pov_char_name = pov_char.name

    lorebook = {
        "title": story.title,
        "genre": story.genre or None,
        "tone": story.tone or None,
        "themes": story.themes or [],
        "central_conflict": story.central_conflict or None,
        "narrative_intent": story.narrative_intent or story.intent or None,
        "logline": story.logline or None,
        "premise": story.premise or None,
        "narrative_perspective": story.narrative_perspective or None,
        "pov_character": pov_char_name,
        "unresolved_goals": [g["text"] for g in (story.goals or []) if not g.get("completed")],
    }

    # ── Active scene (None for story-level / global assistant) ──
    if node is not None:
        prose_preview = (node.content or "")[:PROSE_CONTEXT_LIMIT]
        if len(node.content or "") > PROSE_CONTEXT_LIMIT:
            prose_preview += "…"
        scene = {
            "title": node.title,
            "level_type": node.level_type,
            "synopsis": node.synopsis or None,
            "purpose": (node.metadata_ or {}).get("purpose") or None,
            "entry_state": node.entry_state or None,
            "exit_state": node.exit_state or None,
            "key_events": node.key_events or None,
            "word_count": node.word_count,
            "status": node.status,
            "prose_preview": prose_preview or None,
        }
        node_content = node.content or ""
        node_id_for_threads = node.id
        node_parent_id = node.parent_id
    else:
        scene = None
        node_content = ""
        node_id_for_threads = None
        node_parent_id = None

    # ── Resolve context option flags (default all True) ──
    opts = context_options or ContextOptions()

    # ── Characters mentioned in prose ──
    char_names_mentioned, setting_names_mentioned = _extract_mentions(node_content)

    all_chars = db.query(Character).filter(Character.story_id == story.id).all()
    # Always include light summary of all characters for context
    all_char_summaries = [
        {"name": c.name, "role": c.role, "motivation": c.motivation[:100] if c.motivation else None}
        for c in all_chars
    ]

    mentioned_char_profiles = []
    if opts.include_characters:
        mentioned_chars = [
            c for c in all_chars
            if any(c.name.lower() == n.lower() for n in char_names_mentioned)
        ]
        for c in mentioned_chars:
            profile: dict = {"name": c.name, "role": c.role}
            if c.personality: profile["personality"] = c.personality
            if c.motivation: profile["motivation"] = c.motivation
            if c.background: profile["background"] = c.background[:300]
            if c.arc_notes: profile["arc_notes"] = c.arc_notes
            if c.narrative_intent and not c.narrative_intent_hidden:
                profile["narrative_intent"] = c.narrative_intent
            if c.arc_milestones:
                profile["arc_milestones_pending"] = [
                    m["text"] for m in c.arc_milestones if not m.get("completed")
                ]
            mentioned_char_profiles.append(profile)

    # ── Settings mentioned ──
    mentioned_settings = []
    if opts.include_settings:
        all_settings = db.query(Setting).filter(Setting.story_id == story.id).all()
        mentioned_settings = [
            {"name": s.name, "description": s.description[:200] if s.description else None, "atmosphere": s.atmosphere[:200] if s.atmosphere else None}
            for s in all_settings
            if any(s.name.lower() == n.lower() for n in setting_names_mentioned)
        ]

    # ── Plot threads touching this scene ──
    threads_in_scene: list = []
    all_open_threads: list = []
    if opts.include_threads:
        if node_id_for_threads:
            thread_appearances = db.query(PlotThreadAppearance).filter(PlotThreadAppearance.node_id == node_id_for_threads).all()
            active_thread_ids = {a.thread_id for a in thread_appearances}
            active_threads = db.query(PlotThread).filter(PlotThread.id.in_(active_thread_ids)).all() if active_thread_ids else []
            threads_in_scene = [
                {"name": t.name, "status": t.status, "description": t.description[:150] if t.description else None}
                for t in active_threads
            ]
        all_open_threads = [
            {"name": t.name, "status": t.status}
            for t in db.query(PlotThread).filter(
                PlotThread.story_id == story.id,
                PlotThread.status.in_(["open", "developing"])
            ).all()
        ]

    # ── Sibling context (adjacent scenes) ──
    sibling_context: list = []
    if opts.include_siblings and node is not None:
        siblings = db.query(StructureNode).filter(
            StructureNode.story_id == story.id,
            StructureNode.parent_id == node_parent_id,
            StructureNode.id != node.id,
        ).order_by(StructureNode.position).all()
        sibling_context = [
            {"title": s.title, "synopsis": s.synopsis[:120] if s.synopsis else None, "position": s.position}
            for s in siblings[:6]
        ]

    return {
        "story": lorebook,
        "scene": scene,
        "characters_in_scene": mentioned_char_profiles,
        "all_characters": all_char_summaries,
        "settings_in_scene": mentioned_settings,
        "threads_in_scene": threads_in_scene,
        "open_threads": all_open_threads,
        "sibling_scenes": sibling_context,
    }


# ── Endpoints ──

@router.get("/stories/{story_id}/chat/context")
def get_chat_context(
    story_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the assembled context packet for preview — no AI call."""
    story = _get_story(story_id, db, current_user)
    if node_id in VIRTUAL_NODE_IDS:
        node = None
    else:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
    ctx = _build_context_packet(story, node, db)
    return JSONResponse(ctx)


@router.post("/stories/{story_id}/chat")
async def scene_chat(
    story_id: str,
    node_id: str = Body(...),
    messages: list[dict] = Body(...),
    llm_params: LLMParams | None = Body(None),
    mode: str | None = Body(None),
    context_options: ContextOptions | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a chat response grounded in the current scene's full context."""
    story = _get_story(story_id, db, current_user)
    if node_id in VIRTUAL_NODE_IDS:
        node = None
    else:
        node = db.get(StructureNode, node_id)
        if not node or node.story_id != story_id:
            raise HTTPException(status_code=404, detail="Scene not found")

    ctx = _build_context_packet(story, node, db, context_options)
    if mode == "writing-coach":
        feature_prompt = build_writing_coach_system_prompt(ctx)
    else:
        feature_prompt = build_scene_chat_system_prompt(ctx)

    call_ctx = AICallContext(
        feature=mode if mode else "scene-chat",
        user_id=current_user.id,
        story_id=story_id,
        node_id=node_id,
        tags=["manuscript", "chat", "conversation", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=feature_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
                llm_params=llm_params,
            ):
                yield token
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")


@router.post("/chat/summarize")
async def summarize_conversation(
    messages: list[dict] = Body(...),
    story_id: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a compact summary of the provided conversation messages."""
    if not messages:
        from fastapi.responses import Response as FR
        return FR("No messages to summarize.", media_type="text/plain")

    feature_prompt = (
        "You are a conversation summarizer. "
        "Summarize the key points from the following conversation concisely, "
        "preserving important decisions, questions asked, creative ideas, and "
        "information exchanged. Write in past tense. Be thorough but concise — "
        "aim for 2-4 short paragraphs."
    )

    call_ctx = AICallContext(
        feature="conversation-summarize",
        user_id=current_user.id,
        story_id=story_id,
        tags=["chat", "summarization", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=feature_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
            ):
                yield token
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")
