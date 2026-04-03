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
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..models.setting import Setting
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider

router = APIRouter()

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


def _build_context_packet(story: Story, node: StructureNode, db: Session) -> dict:
    """Assemble the full context dict — used for both the preview endpoint and chat."""

    # ── Lorebook ──
    lorebook = {
        "title": story.title,
        "genre": story.genre or None,
        "tone": story.tone or None,
        "themes": story.themes or [],
        "central_conflict": story.central_conflict or None,
        "narrative_intent": story.narrative_intent or story.intent or None,
        "logline": story.logline or None,
        "premise": story.premise or None,
        "unresolved_goals": [g["text"] for g in (story.goals or []) if not g.get("completed")],
    }

    # ── Active scene ──
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

    # ── Characters mentioned in prose ──
    char_names_mentioned, setting_names_mentioned = _extract_mentions(node.content or "")

    all_chars = db.query(Character).filter(Character.story_id == story.id).all()
    mentioned_chars = [
        c for c in all_chars
        if any(c.name.lower() == n.lower() for n in char_names_mentioned)
    ]
    # Also include all story characters in a lighter form for context
    all_char_summaries = [
        {"name": c.name, "role": c.role, "motivation": c.motivation[:100] if c.motivation else None}
        for c in all_chars
    ]

    mentioned_char_profiles = []
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
    all_settings = db.query(Setting).filter(Setting.story_id == story.id).all()
    mentioned_settings = [
        {"name": s.name, "description": s.description[:200] if s.description else None, "atmosphere": s.atmosphere[:200] if s.atmosphere else None}
        for s in all_settings
        if any(s.name.lower() == n.lower() for n in setting_names_mentioned)
    ]

    # ── Plot threads touching this scene ──
    thread_appearances = db.query(PlotThreadAppearance).filter(PlotThreadAppearance.node_id == node.id).all()
    active_thread_ids = {a.thread_id for a in thread_appearances}
    active_threads = db.query(PlotThread).filter(PlotThread.id.in_(active_thread_ids)).all() if active_thread_ids else []
    threads_in_scene = [
        {"name": t.name, "status": t.status, "description": t.description[:150] if t.description else None}
        for t in active_threads
    ]

    # All open/developing threads (for wider awareness)
    all_open_threads = [
        {"name": t.name, "status": t.status}
        for t in db.query(PlotThread).filter(
            PlotThread.story_id == story.id,
            PlotThread.status.in_(["open", "developing"])
        ).all()
    ]

    # ── Sibling context (adjacent scenes) ──
    siblings = db.query(StructureNode).filter(
        StructureNode.story_id == story.id,
        StructureNode.parent_id == node.parent_id,
        StructureNode.id != node.id,
    ).order_by(StructureNode.position).all()
    sibling_context = [
        {"title": s.title, "synopsis": s.synopsis[:120] if s.synopsis else None, "position": s.position}
        for s in siblings[:6]  # nearest 6 siblings
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


def _build_system_prompt(ctx: dict) -> str:
    s = ctx["story"]
    sc = ctx["scene"]

    lines = [
        "You are a creative writing assistant embedded in LoreStudio, helping an author with their story.",
        "",
        f"## Story: {s['title']}",
    ]
    if s.get("genre"): lines.append(f"Genre: {s['genre']}")
    if s.get("tone"): lines.append(f"Tone: {s['tone']}")
    if s.get("themes"): lines.append(f"Themes: {', '.join(s['themes'])}")
    if s.get("central_conflict"): lines.append(f"Central conflict: {s['central_conflict']}")
    if s.get("narrative_intent"): lines.append(f"Author's intent: {s['narrative_intent']}")
    if s.get("logline"): lines.append(f"Logline: {s['logline']}")
    if s.get("unresolved_goals"):
        lines.append(f"Unresolved story goals: {'; '.join(s['unresolved_goals'])}")

    lines += ["", f"## Current scene: {sc['title']} ({sc.get('level_type', 'scene')})"]
    if sc.get("synopsis"): lines.append(f"Synopsis: {sc['synopsis']}")
    if sc.get("purpose"): lines.append(f"Purpose: {sc['purpose']}")
    if sc.get("entry_state"): lines.append(f"Entry state: {sc['entry_state']}")
    if sc.get("exit_state"): lines.append(f"Exit state (goal): {sc['exit_state']}")
    if sc.get("key_events"): lines.append(f"Key events planned: {sc['key_events']}")
    if sc.get("prose_preview"):
        lines += ["", "Prose so far (excerpt):", sc["prose_preview"]]

    if ctx["characters_in_scene"]:
        lines += ["", "## Characters in this scene"]
        for c in ctx["characters_in_scene"]:
            lines.append(f"\n### {c['name']} ({c.get('role', '')})")
            if c.get("personality"): lines.append(f"Personality: {c['personality']}")
            if c.get("motivation"): lines.append(f"Motivation: {c['motivation']}")
            if c.get("arc_notes"): lines.append(f"Arc: {c['arc_notes']}")
            if c.get("narrative_intent"): lines.append(f"Author's plan for this character: {c['narrative_intent']}")
            if c.get("arc_milestones_pending"):
                lines.append(f"Pending arc milestones: {'; '.join(c['arc_milestones_pending'])}")
    elif ctx["all_characters"]:
        lines += ["", "## Story characters (all)"]
        for c in ctx["all_characters"]:
            line = f"- {c['name']} ({c['role']})"
            if c.get("motivation"): line += f": {c['motivation']}"
            lines.append(line)

    if ctx["settings_in_scene"]:
        lines += ["", "## Settings in this scene"]
        for setting in ctx["settings_in_scene"]:
            lines.append(f"\n### {setting['name']}")
            if setting.get("description"): lines.append(setting["description"])
            if setting.get("atmosphere"): lines.append(f"Atmosphere: {setting['atmosphere']}")

    if ctx["threads_in_scene"]:
        lines += ["", "## Plot threads active in this scene"]
        for t in ctx["threads_in_scene"]:
            line = f"- {t['name']} [{t['status']}]"
            if t.get("description"): line += f": {t['description']}"
            lines.append(line)
    if ctx["open_threads"]:
        open_names = [t["name"] for t in ctx["open_threads"] if t not in ctx["threads_in_scene"]]
        if open_names:
            lines.append(f"\nOther open threads in this story: {', '.join(open_names)}")

    if ctx["sibling_scenes"]:
        lines += ["", "## Other scenes in this section"]
        for sib in ctx["sibling_scenes"]:
            line = f"- {sib['title']}"
            if sib.get("synopsis"): line += f": {sib['synopsis']}"
            lines.append(line)

    lines += [
        "",
        "---",
        "You are a thoughtful collaborator, not a content generator. Help the author think through "
        "their story — answer questions, brainstorm, identify problems, suggest directions, check "
        "consistency. Never write prose for them unless explicitly asked. Respond in the author's "
        "perspective, not the characters'. Keep responses focused and useful.",
    ]

    return "\n".join(lines)


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a chat response grounded in the current scene's full context."""
    story = _get_story(story_id, db, current_user)
    node = db.get(StructureNode, node_id)
    if not node or node.story_id != story_id:
        raise HTTPException(status_code=404, detail="Scene not found")

    ctx = _build_context_packet(story, node, db)
    system_prompt = _build_system_prompt(ctx)

    async def stream():
        try:
            async for token in ollama_provider.chat_stream(messages, system_prompt):
                yield token
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")
