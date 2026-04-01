from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character
from ..auth.dependencies import get_current_user
from ..services.llm.ollama import ollama_provider

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
    intent_line = f"\nStory intent: {story.narrative_intent or story.intent}\n" if (story.narrative_intent or story.intent) else ""

    system_prompt = (
        f"You are summarizing the section '{node.title}' from the story '{story.title}'.{intent_line}\n\n"
        f"Content:\n{content_text}\n\n"
        "Provide a concise, clear summary in 3-5 sentences. Focus on plot events, character actions, and what is established. "
        "Write in present tense."
    )
    llm_messages = [{"role": "user", "content": "Summarize this section."}]

    async def stream():
        async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
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

    system_prompt = (
        f"You are analyzing the character arc of {character.name} in '{story.title}'.\n\n"
        f"Character profile:\n{chr(10).join(profile_parts) if profile_parts else 'No profile yet.'}"
        f"{milestones_text}\n\n"
        f"Scenes where {character.name} appears:\n{scenes_text}\n\n"
        f"Answer: Where is {character.name} right now in their arc? What have they done, how have they changed, "
        f"and what still needs to happen? Be specific about what's been written vs. what's planned."
    )
    llm_messages = [{"role": "user", "content": f"Where is {character.name} in their arc?"}]

    async def stream():
        async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")
