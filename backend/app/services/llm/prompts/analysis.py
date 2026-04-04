"""
Analysis prompts — character arc analysis, MICE economy, session recap.
"""

from ....models.character import Character
from ....models.story import Story


def build_character_arc_prompt(
    character: Character,
    story_title: str,
    profile_parts: list[str],
    milestones_text: str,
    scenes_text: str,
) -> str:
    """Prompt to analyze where a character is in their arc based on written content."""
    return (
        f"You are analyzing the character arc of {character.name} in '{story_title}'.\n\n"
        f"Character profile:\n{chr(10).join(profile_parts) if profile_parts else 'No profile yet.'}"
        f"{milestones_text}\n\n"
        f"Scenes where {character.name} appears:\n{scenes_text}\n\n"
        f"Answer: Where is {character.name} right now in their arc? What have they done, how have they changed, "
        f"and what still needs to happen? Be specific about what's been written vs. what's planned."
    )


def build_economy_analysis_prompt(
    story_title: str,
    story_intent: str | None,
    length_context: str,
    threads_summary: list[str],
    scenes_info: list[str],
) -> str:
    """Prompt to analyze story economy against MICE principles for short fiction."""
    return f"""You are a short fiction editor analyzing story economy for "{story_title}".

{length_context}Story intent: {story_intent or "Not specified"}

MICE THREADS ({len(threads_summary)} total):
{chr(10).join(threads_summary) if threads_summary else "No threads defined yet."}

SCENES ({len(scenes_info)} total):
{chr(10).join(scenes_info) if scenes_info else "No scenes yet."}

Analyze this story's economy from a short fiction perspective. Structure your response as:

**Thread Balance**
How many MICE threads are open? Is this appropriate for the intended form? Are any threads untyped that should be tagged?

**Scene Economy**
Which scenes serve no thread (marked "NO THREAD")? Are any scenes doing redundant work? Is word count distributed effectively?

**Try/Fail Cycles**
Which threads have insufficient struggle before resolution? Are there threads resolved too cleanly?

**Recommendations**
3-5 specific, actionable suggestions for tightening the story. Be concrete — reference scene and thread names."""


def build_session_recap_prompt(
    story_title: str,
    story_overview: str,
    scenes_text: str,
    activity_text: str,
    interviews_text: str,
) -> str:
    """Prompt to generate a warm, informative recap of the writer's recent work."""
    return f"""You are a writing companion for the story "{story_title}".

Story overview: {story_overview}

Here is what the writer has been working on recently:

RECENTLY EDITED SCENES:
{scenes_text or "None."}

RECENT ACTIVITY:
{activity_text or "None."}

RECENT CHARACTER INTERVIEWS:
{interviews_text or "None."}

Write a brief, warm, encouraging recap of what the writer worked on. Speak directly to them ("You've been..."). Keep it to 3–5 sentences. Focus on what was accomplished and what threads are still in motion. Don't list everything mechanically — weave it into a natural paragraph that makes them feel the momentum of their work. Don't offer suggestions or critique."""
