"""
Summary prompts — scene summaries, story summaries, structure section summaries.
"""

from ....models.structure import StructureNode
from ....models.story import Story


def build_story_summary_prompt(
    title: str,
    intent: str | None,
    nodes_content: list[dict],
    up_to_title: str | None,
    style: str,
) -> str:
    """Prompt to summarize the story up to a given point."""
    content_text = "\n\n".join(
        f"[{n['title']}]\n{n['content']}" for n in nodes_content if n.get("content")
    )
    if not content_text:
        return f"The story '{title}' has no written content yet."

    scope = f"up to and including '{up_to_title}'" if up_to_title else "the entire story so far"
    detail = "concise (3-5 sentences)" if style == "brief" else "detailed (several paragraphs)"

    intent_line = f"\nThe author's stated intent: {intent}\n" if intent else ""

    return (
        f"You are a literary assistant summarizing the story '{title}'.{intent_line}\n"
        f"Provide a {detail} summary of {scope}.\n\n"
        f"Story content:\n{content_text}\n\n"
        "Focus on plot, character actions, and key developments. Write in present tense."
    )


def build_scene_summary_prompt(node_title: str, node_content: str) -> str:
    """Prompt to summarize a single scene's prose content."""
    return (
        "You are a literary assistant helping an author document their story. "
        "Summarize the following scene in 2-3 sentences, focusing on key events and character actions. "
        "Write in present tense. Be specific and concise."
    )


def build_structure_section_summary_prompt(
    story_title: str,
    story_intent: str | None,
    node_title: str,
    content_text: str,
) -> str:
    """Prompt to summarize an act, chapter, or structural section."""
    intent_line = f"\nStory intent: {story_intent}\n" if story_intent else ""
    return (
        f"You are summarizing the section '{node_title}' from the story '{story_title}'.{intent_line}\n\n"
        f"Content:\n{content_text}\n\n"
        "Provide a concise, clear summary in 3-5 sentences. Focus on plot events, character actions, and what is established. "
        "Write in present tense."
    )
