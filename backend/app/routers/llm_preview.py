"""
LLM Transparency — prompt preview endpoint.

Returns the exact system prompt that would be sent to the LLM for a given
interaction, enabling the author to see exactly what data is shared with the AI.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character, CharacterRelationship
from ..models.interview import CharacterInterview
from ..models.panel_interview import PanelInterview
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..services.llm.gateway import ai_gateway
from ..services.llm.ollama import ollama_provider
from ..services.llm.prompts.generation import (
    build_attribute_generation_prompt,
    build_relationship_suggestion_prompt,
)
from ..services.llm.prompts.interviews import (
    build_character_interview_system_prompt,
    build_interview_summary_prompt,
    build_panel_interview_system_prompt,
)
from ..services.llm.prompts.summaries import build_story_summary_prompt

router = APIRouter()


class PromptPreviewRequest(BaseModel):
    context_type: str
    story_id: str | None = None
    node_id: str | None = None
    interview_id: str | None = None
    panel_id: str | None = None
    character_id: str | None = None
    attribute_type: str | None = None
    user_message: str | None = None
    context_options: dict | None = None  # Forwarded to _build_context_packet as ContextOptions


class ContextSource(BaseModel):
    """Describes one piece of data that will be included in the LLM prompt."""

    source: str  # e.g., "character_personality", "scene_content"
    label: str  # Human-readable: "Marcus Chen's personality"
    included: bool  # Whether this data exists and will be included


class TokenBreakdown(BaseModel):
    """Estimated token counts for the composed prompt (using len // 4 heuristic)."""

    system_prompt: int  # Tokens for the system/feature prompt only
    context: int  # Additional tokens from core prompt wrapping


class PromptPreviewResponse(BaseModel):
    context_type: str
    system_prompt: str  # Feature-specific prompt only
    composed_prompt: str  # Core + feature prompt (what actually gets sent)
    user_message: str
    model: str
    sources: list[ContextSource] = []
    core_prompt_is_custom: bool = False
    token_breakdown: TokenBreakdown | None = None


def _character_sources(char: Character, prefix: str = "") -> list[ContextSource]:
    """Extract context sources from a character profile."""
    name = f"{prefix}{char.name}" if prefix else char.name
    return [
        ContextSource(source="character_name", label=f"{name}", included=True),
        ContextSource(source="character_personality", label=f"{name}'s personality", included=bool(char.personality)),
        ContextSource(source="character_motivation", label=f"{name}'s motivation", included=bool(char.motivation)),
        ContextSource(source="character_background", label=f"{name}'s background", included=bool(char.background)),
        ContextSource(source="character_appearance", label=f"{name}'s appearance", included=bool(char.appearance)),
        ContextSource(source="character_traits", label=f"{name}'s traits", included=bool(char.traits)),
        ContextSource(source="character_arc_notes", label=f"{name}'s arc notes", included=bool(char.arc_notes)),
    ]


@router.post("/llm/prompt-preview", response_model=PromptPreviewResponse)
def get_prompt_preview(
    body: PromptPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the exact system prompt that would be sent to the LLM."""

    def _get_story(story_id: str) -> Story:
        story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        return story

    system_prompt = ""
    user_message = body.user_message or ""
    sources: list[ContextSource] = []

    if body.context_type == "scene-chat":
        if not body.story_id or not body.node_id:
            raise HTTPException(status_code=400, detail="story_id and node_id required")
        from ..services.llm.prompts.chat import build_scene_chat_system_prompt
        from .chat import ContextOptions, _build_context_packet

        story = _get_story(body.story_id)
        node = db.get(StructureNode, body.node_id)
        if not node or node.story_id != body.story_id:
            raise HTTPException(status_code=404, detail="Scene not found")
        ctx_opts = ContextOptions(**(body.context_options or {})) if body.context_options is not None else None
        ctx = _build_context_packet(story, node, db, ctx_opts)
        system_prompt = build_scene_chat_system_prompt(ctx)
        if not user_message:
            user_message = "[your message to the scene assistant]"
        chars_in_scene = ctx.get("characters_in_scene", [])
        threads_in_scene = ctx.get("threads_in_scene", [])
        settings_in_scene = ctx.get("settings_in_scene", [])
        sources = [
            ContextSource(source="story_title", label=f"Story: {story.title}", included=True),
            ContextSource(
                source="story_intent", label="Story intent", included=bool(story.narrative_intent or story.intent)
            ),
            ContextSource(source="story_goals", label="Story goals", included=bool(story.goals)),
            ContextSource(source="scene_metadata", label=f"Scene: {node.title}", included=True),
            ContextSource(source="scene_synopsis", label="Scene synopsis", included=bool(node.synopsis)),
            ContextSource(
                source="scene_purpose", label="Scene purpose", included=bool((node.metadata_ or {}).get("purpose"))
            ),
            ContextSource(
                source="scene_entry_exit", label="Entry/exit state", included=bool(node.entry_state or node.exit_state)
            ),
            ContextSource(
                source="characters_in_scene",
                label=f"Characters in scene ({len(chars_in_scene)})",
                included=bool(chars_in_scene),
            ),
            ContextSource(
                source="threads_in_scene",
                label=f"Plot threads ({len(threads_in_scene)})",
                included=bool(threads_in_scene),
            ),
            ContextSource(
                source="settings_in_scene",
                label=f"Settings ({len(settings_in_scene)})",
                included=bool(settings_in_scene),
            ),
        ]

    elif body.context_type == "interview":
        if not body.interview_id:
            raise HTTPException(status_code=400, detail="interview_id required")
        interview = db.get(CharacterInterview, body.interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        character = db.get(Character, interview.character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        _get_story(character.story_id)  # ownership check
        system_prompt = build_character_interview_system_prompt(character)
        if not user_message:
            user_message = "[your message to the character]"
        msg_count = len(interview.messages) if interview.messages else 0
        sources = _character_sources(character) + [
            ContextSource(source="interview_history", label=f"Prior messages ({msg_count})", included=msg_count > 0),
        ]

    elif body.context_type == "interview-summary":
        if not body.interview_id:
            raise HTTPException(status_code=400, detail="interview_id required")
        interview = db.get(CharacterInterview, body.interview_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        character = db.get(Character, interview.character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        _get_story(character.story_id)  # ownership check
        system_prompt = build_interview_summary_prompt(character, interview.messages)
        user_message = "Please summarize this interview."
        msg_count = len(interview.messages) if interview.messages else 0
        sources = [
            ContextSource(source="character_name", label=character.name, included=True),
            ContextSource(
                source="interview_transcript",
                label=f"Interview transcript ({msg_count} messages)",
                included=msg_count > 0,
            ),
        ]

    elif body.context_type == "panel":
        if not body.panel_id:
            raise HTTPException(status_code=400, detail="panel_id required")
        panel = db.get(PanelInterview, body.panel_id)
        if not panel:
            raise HTTPException(status_code=404, detail="Panel not found")
        _get_story(panel.story_id)  # ownership check
        characters = [c for c in (db.get(Character, cid) for cid in panel.character_ids) if c]
        system_prompt = build_panel_interview_system_prompt(characters)
        if not user_message:
            user_message = "[your message to the panel]"
        for char in characters:
            sources.extend(_character_sources(char))

    elif body.context_type == "attributes":
        if not body.character_id or not body.attribute_type:
            raise HTTPException(status_code=400, detail="character_id and attribute_type required")
        character = db.get(Character, body.character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        _get_story(character.story_id)  # ownership check
        system_prompt = build_attribute_generation_prompt(character, body.attribute_type)
        user_message = f"Please suggest {body.attribute_type} for this character."
        sources = _character_sources(character)

    elif body.context_type == "story-summary":
        if not body.story_id:
            raise HTTPException(status_code=400, detail="story_id required")
        story = _get_story(body.story_id)
        all_nodes = (
            db.query(StructureNode)
            .filter(StructureNode.story_id == body.story_id)
            .order_by(StructureNode.position)
            .all()
        )
        nodes_content = [{"title": n.title, "content": n.content} for n in all_nodes if n.content and n.content.strip()]
        system_prompt = build_story_summary_prompt(
            title=story.title,
            intent=story.narrative_intent or story.intent,
            nodes_content=nodes_content,
            up_to_title=None,
            style="brief",
        )
        user_message = "Please provide the summary."
        sources = [
            ContextSource(source="story_title", label=f"Story: {story.title}", included=True),
            ContextSource(
                source="story_intent", label="Story intent", included=bool(story.narrative_intent or story.intent)
            ),
            ContextSource(
                source="scene_content", label=f"Written scenes ({len(nodes_content)})", included=bool(nodes_content)
            ),
        ]

    elif body.context_type == "relationships":
        if not body.story_id:
            raise HTTPException(status_code=400, detail="story_id required")
        story = _get_story(body.story_id)
        characters = db.query(Character).filter(Character.story_id == body.story_id).all()
        existing_rels = (
            db.query(CharacterRelationship)
            .filter(CharacterRelationship.character_id.in_([c.id for c in characters]))
            .all()
        )
        char_names = {c.id: c.name for c in characters}
        existing = [
            {
                "from": char_names.get(r.character_id, "?"),
                "to": char_names.get(r.related_character_id, "?"),
                "type": r.relationship_type,
            }
            for r in existing_rels
        ]
        system_prompt = build_relationship_suggestion_prompt(characters, existing)
        user_message = "Please suggest relationships."
        sources = [
            ContextSource(source="characters", label=f"Characters ({len(characters)})", included=bool(characters)),
            ContextSource(
                source="existing_relationships",
                label=f"Existing relationships ({len(existing_rels)})",
                included=bool(existing_rels),
            ),
        ]
        for char in characters:
            sources.append(ContextSource(source="character_profile", label=f"{char.name}", included=True))

    elif body.context_type == "structure-summary":
        if not body.story_id or not body.node_id:
            raise HTTPException(status_code=400, detail="story_id and node_id required")
        story = _get_story(body.story_id)
        node = db.get(StructureNode, body.node_id)
        if not node or node.story_id != body.story_id:
            raise HTTPException(status_code=404, detail="Section not found")

        def gather_content(n: StructureNode) -> list[str]:
            pieces = []
            if n.content and n.content.strip():
                pieces.append(f"[{n.title}]\n{n.content}")
            for child in sorted(n.children, key=lambda c: c.position):
                pieces.extend(gather_content(child))
            return pieces

        content_pieces = gather_content(node)
        content_text = "\n\n".join(content_pieces)
        intent_line = (
            f"\nStory intent: {story.narrative_intent or story.intent}\n"
            if (story.narrative_intent or story.intent)
            else ""
        )
        system_prompt = (
            f"You are summarizing the section '{node.title}' from the story '{story.title}'.{intent_line}\n\n"
            f"Content:\n{content_text}\n\n"
            "Provide a concise, clear summary in 3-5 sentences. Focus on plot events, character actions, and what is established. "
            "Write in present tense."
        )
        user_message = "Summarize this section."
        sources = [
            ContextSource(source="story_title", label=f"Story: {story.title}", included=True),
            ContextSource(
                source="story_intent", label="Story intent", included=bool(story.narrative_intent or story.intent)
            ),
            ContextSource(
                source="section_content",
                label=f"Section: {node.title} ({len(content_pieces)} sub-sections)",
                included=bool(content_pieces),
            ),
        ]

    elif body.context_type == "character-arc":
        if not body.story_id or not body.character_id:
            raise HTTPException(status_code=400, detail="story_id and character_id required")
        story = _get_story(body.story_id)
        character = db.get(Character, body.character_id)
        if not character or character.story_id != body.story_id:
            raise HTTPException(status_code=404, detail="Character not found")

        all_nodes = db.query(StructureNode).filter(StructureNode.story_id == body.story_id).all()
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
            done = [m["text"] for m in character.arc_milestones if m.get("completed")]
            pending = [m["text"] for m in character.arc_milestones if not m.get("completed")]
            if done:
                milestones_text += f"\nCompleted milestones: {', '.join(done)}"
            if pending:
                milestones_text += f"\nRemaining milestones: {', '.join(pending)}"

        scenes_text = "\n\n".join(relevant_scenes) if relevant_scenes else "No scenes mentioning this character yet."
        system_prompt = (
            f"You are analyzing the character arc of {character.name} in '{story.title}'.\n\n"
            f"Character profile:\n{chr(10).join(profile_parts) if profile_parts else 'No profile yet.'}"
            f"{milestones_text}\n\n"
            f"Scenes where {character.name} appears:\n{scenes_text}\n\n"
            f"Answer: Where is {character.name} right now in their arc? What have they done, how have they changed, "
            f"and what still needs to happen? Be specific about what's been written vs. what's planned."
        )
        user_message = f"Where is {character.name} in their arc?"
        sources = [
            ContextSource(source="character_name", label=character.name, included=True),
            ContextSource(source="character_personality", label="Personality", included=bool(character.personality)),
            ContextSource(source="character_motivation", label="Motivation", included=bool(character.motivation)),
            ContextSource(source="character_arc_notes", label="Arc notes", included=bool(character.arc_notes)),
            ContextSource(
                source="character_narrative_intent", label="Planned arc", included=bool(character.narrative_intent)
            ),
            ContextSource(
                source="character_milestones", label="Arc milestones", included=bool(character.arc_milestones)
            ),
            ContextSource(
                source="scenes_mentioning_character",
                label=f"Scenes mentioning {character.name} ({len(relevant_scenes)})",
                included=bool(relevant_scenes),
            ),
        ]

    else:
        raise HTTPException(status_code=400, detail=f"Unknown context_type: {body.context_type}")

    user_ai = (current_user.settings or {}).get("ai", {})
    composed_prompt = ai_gateway.compose_prompt(system_prompt, current_user)
    core_is_custom = bool(user_ai.get("core_prompt"))

    system_tokens = len(system_prompt) // 4
    composed_tokens = len(composed_prompt) // 4
    context_tokens = max(0, composed_tokens - system_tokens)
    token_breakdown = TokenBreakdown(system_prompt=system_tokens, context=context_tokens)

    return PromptPreviewResponse(
        context_type=body.context_type,
        system_prompt=system_prompt,
        composed_prompt=composed_prompt,
        user_message=user_message,
        model=ollama_provider.model,
        sources=sources,
        core_prompt_is_custom=core_is_custom,
        token_breakdown=token_breakdown,
    )
