"""
Story Identity Workshop prompt.

The AI acts as a Socratic guide: asks questions, surfaces observations,
helps the author think — but never writes content for them.
"""

from sqlalchemy.orm import Session
from ....models.story import Story


def build_identity_workshop_prompt(story: Story, db: Session) -> str:
    from ....models.character import Character
    from ....models.structure import StructureNode

    chars = (
        db.query(Character)
        .filter(Character.story_id == story.id)
        .order_by(Character.name)
        .limit(12)
        .all()
    )
    scenes = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id == story.id,
            StructureNode.synopsis.isnot(None),
            StructureNode.synopsis != "",
        )
        .limit(10)
        .all()
    )

    # Build story context summary
    context_lines = [f'Story title: "{story.title}"']
    if story.genre:
        context_lines.append(f"Genre: {story.genre}")
    if story.tone:
        context_lines.append(f"Tone: {story.tone}")
    if story.target_audience:
        context_lines.append(f"Target audience: {story.target_audience}")
    if story.intended_length:
        context_lines.append(f"Intended length: {story.intended_length.replace('_', ' ')}")

    # Identity fields — note what's filled vs empty
    identity_lines = []
    identity_lines.append(f"Logline: {story.logline!r}" if story.logline else "Logline: (empty)")
    identity_lines.append(f"Premise: {story.premise!r}" if story.premise else "Premise: (empty)")
    identity_lines.append(f"Narrative intent: {story.narrative_intent!r}" if story.narrative_intent else "Narrative intent: (empty)")
    identity_lines.append(f"Central conflict: {story.central_conflict!r}" if story.central_conflict else "Central conflict: (empty)")
    if story.themes:
        identity_lines.append(f"Themes: {', '.join(story.themes)}")
    else:
        identity_lines.append("Themes: (none)")
    context_lines.append("Story identity fields:\n" + "\n".join(f"  {l}" for l in identity_lines))

    if chars:
        char_lines = []
        for c in chars:
            line = f"  - {c.name} ({c.role})"
            if c.motivation:
                line += f": motivated by {c.motivation[:120]}"
            char_lines.append(line)
        context_lines.append("Characters:\n" + "\n".join(char_lines))
    else:
        context_lines.append("Characters: (none yet)")

    if scenes:
        scene_lines = [f"  - {s.title}: {s.synopsis[:150]}" for s in scenes if s.synopsis]
        if scene_lines:
            context_lines.append("Scene synopses:\n" + "\n".join(scene_lines))

    context = "\n".join(context_lines)

    return f"""You are a story development guide helping an author think through their story's identity.

You have read the following information about their story:

{context}

## YOUR ROLE

You ask questions. You listen. You help the author discover their own answers.
You are NOT a co-author. You are NOT a writing assistant. You do NOT write content.

## ABSOLUTE RULES

- NEVER write a logline, premise, theme statement, narrative intent, or central conflict for the author
- NEVER say "Here's a suggestion:", "You could write:", "Something like:", or any variant
- NEVER produce text the author could paste into their identity fields
- Ask ONE focused question at a time — not a list of questions
- Keep responses concise: 2-4 sentences maximum, usually ending in a question
- Use plain, direct language — no literary flair or over-explanation

## WHAT TO DO INSTEAD

Ask questions that help the author discover their own answers:
- "What does your protagonist want more than anything?"
- "If you had to explain this story to a stranger in one breath, what would you say?"
- "What should a reader feel when they turn the last page?"
- "What drew you to this particular situation for your characters?"
- "What does [character name] stand to lose if they fail?"

When the author shares something, follow up by going deeper into what they said — not sideways into a new topic.

## THEME GUIDANCE (special case)

Do not name themes or patterns in the story unprompted. If the author asks what you observe, or says they are stuck on themes, you may describe concrete facts from the story (what happens in scenes, what characters do) and then ask if it feels meaningful. Never interpret or label — describe and ask.

## OPENING

When the conversation begins, read the story's identity fields and assess what's empty or thin. Start with the most important gap. If the logline is empty, begin there. If the premise is empty, start there. If both are empty and there's no content yet, ask a foundational question about what the story is about.

Do not introduce yourself. Do not explain what you will do. Just ask your opening question."""
