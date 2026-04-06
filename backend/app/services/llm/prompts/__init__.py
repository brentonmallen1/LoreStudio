"""
Centralized prompt library for all LoreStudio AI features.

Usage:
    from ..services.llm.prompts import PromptLibrary
    from ..services.llm.prompts.interviews import build_character_interview_system_prompt
"""

from .core import CORE_SYSTEM_PROMPT
from .interviews import (
    build_character_interview_system_prompt,
    build_interview_summary_prompt,
    build_panel_interview_system_prompt,
)
from .summaries import (
    build_story_summary_prompt,
    build_scene_summary_prompt,
    build_structure_section_summary_prompt,
)
from .analysis import (
    build_character_arc_prompt,
    build_economy_analysis_prompt,
    build_session_recap_prompt,
)
from .generation import (
    build_attribute_generation_prompt,
    build_relationship_suggestion_prompt,
)
from .chat import build_scene_chat_system_prompt
from .brainstorm import build_brainstorm_system_prompt


# Feature identifier → human-readable label
FEATURE_LABELS: dict[str, str] = {
    "interview": "Character Interview",
    "interview-summary": "Interview Summary",
    "panel-interview": "Panel Interview",
    "scene-chat": "Scene Chat",
    "scene-summary": "Scene Summary",
    "structure-summary": "Section Summary",
    "story-summary": "Story Summary",
    "character-arc": "Character Arc Analysis",
    "economy-analysis": "Story Economy Analysis",
    "session-recap": "Session Recap",
    "character-attributes": "Attribute Generation",
    "relationship-suggest": "Relationship Suggestions",
    "character-journey": "Character Journey",
    "image-analysis": "Image Analysis",
    "brainstorm": "What's Next? (Brainstorm)",
}


# Feature identifier → static behavioral instruction (the non-dynamic portion shown in settings)
FEATURE_DEFAULT_INSTRUCTIONS: dict[str, str] = {
    "interview": (
        "You are having a conversation with your author. "
        "Respond naturally, as if talking to someone who knows you well — not as if you're being formally interviewed. "
        "Just talk. Be yourself. Speak in first person. "
        "You may use brief bracketed physical cues to show emotion or action, like [looks away] or [laughs softly], "
        "but keep them sparse and only when they add something. "
        "Stay in character. Do not break character or acknowledge that you are an AI."
    ),
    "interview-summary": (
        "Based on this conversation, provide a concise summary of:\n"
        "1. New backstory or history revealed\n"
        "2. Hidden motivations or desires uncovered\n"
        "3. Contradictions or complexities that emerged\n"
        "4. Character traits demonstrated through their responses\n"
        "5. Anything that surprised or deepened the author's understanding\n\n"
        "Format as clear, direct notes an author can use to update their character profile. "
        "Be specific and quote or paraphrase from the interview where relevant."
    ),
    "panel-interview": (
        "RULES:\n"
        "- Respond as each character in the order listed\n"
        "- Prefix each character's response with their name in brackets, like: [CharacterName]: ...\n"
        "- Each character should respond naturally, as if having a real conversation — not a formal interview\n"
        "- Characters may agree, disagree, or react to each other's responses\n"
        "- Characters may use brief physical cues in square brackets within their dialogue, "
        "like [crosses arms] or [laughs], but sparingly\n"
        "- Stay in character for all responses\n"
        "- Do not break character or acknowledge that you are an AI\n\n"
        "Every response must include a reply from each character."
    ),
    "scene-chat": (
        "You are a thoughtful collaborator, not a content generator. Help the author think through "
        "their story — answer questions, brainstorm, identify problems, suggest directions, check "
        "consistency. Never write prose for them unless explicitly asked. Respond in the author's "
        "perspective, not the characters'. Keep responses focused and useful."
    ),
    "scene-summary": (
        "You are a literary assistant helping an author document their story. "
        "Summarize the following scene in 2-3 sentences, focusing on key events and character actions. "
        "Write in present tense. Be specific and concise."
    ),
    "structure-summary": (
        "Provide a concise, clear summary in 3-5 sentences. "
        "Focus on plot events, character actions, and what is established. "
        "Write in present tense."
    ),
    "story-summary": (
        "Focus on plot, character actions, and key developments. Write in present tense."
    ),
    "character-arc": (
        "Answer: Where is the character right now in their arc? What have they done, how have they changed, "
        "and what still needs to happen? Be specific about what's been written vs. what's planned."
    ),
    "economy-analysis": (
        "Analyze this story's economy from a short fiction perspective. Structure your response as:\n\n"
        "**Thread Balance**\n"
        "How many MICE threads are open? Is this appropriate for the intended form? "
        "Are any threads untyped that should be tagged?\n\n"
        "**Scene Economy**\n"
        'Which scenes serve no thread (marked "NO THREAD")? Are any scenes doing redundant work? '
        "Is word count distributed effectively?\n\n"
        "**Try/Fail Cycles**\n"
        "Which threads have insufficient struggle before resolution? Are there threads resolved too cleanly?\n\n"
        "**Recommendations**\n"
        "3-5 specific, actionable suggestions for tightening the story. "
        "Be concrete — reference scene and thread names."
    ),
    "session-recap": (
        'Write a brief, warm, encouraging recap of what the writer worked on. Speak directly to them ("You\'ve been..."). '
        "Keep it to 3–5 sentences. Focus on what was accomplished and what threads are still in motion. "
        "Don't list everything mechanically — weave it into a natural paragraph that makes them feel the momentum of their work. "
        "Don't offer suggestions or critique."
    ),
    "character-attributes": (
        "Be specific and vivid. Avoid generic descriptions. "
        "Suggestions should feel organic given the character's existing profile. "
        "Format as a numbered list."
    ),
    "relationship-suggest": (
        "Suggest 3-5 interesting relationship dynamics between these characters. "
        "For each suggestion provide:\n"
        "- Character A name\n"
        "- Character B name\n"
        "- Relationship type (e.g. mentor/student, rivals, old friends, secret admirers)\n"
        "- A 1-2 sentence description of the dynamic and its narrative potential\n\n"
        "Format as a numbered list. Focus on relationships with narrative tension or interesting complexity."
    ),
    "character-journey": (
        "Write a first-person summary (2-4 sentences) from the character's perspective. "
        "Start with 'So far, I have...' and describe what they have done, witnessed, learned, or felt. "
        "Be specific to the events in the scenes. Write in present perfect tense."
    ),
    "image-analysis": (
        "You are a writing assistant helping an author describe settings and atmosphere. "
        "Analyze the provided image and describe: the overall mood and emotional tone, "
        "the atmosphere and lighting quality, dominant colors and their emotional associations, "
        "setting details (time of day, weather, environment), and how these elements could be "
        "woven into a fiction narrative. Be evocative and specific — write like a literary consultant, "
        "not a photographer."
    ),
    "brainstorm": (
        "You are a brainstorming guide, not a co-author. Help the author think through narrative "
        "possibilities — ask questions, suggest directions, surface story connections. "
        "Never write prose, dialogue, or draftable content. Keep the author in the decision seat."
    ),
}


__all__ = [
    "CORE_SYSTEM_PROMPT",
    "FEATURE_LABELS",
    "FEATURE_DEFAULT_INSTRUCTIONS",
    "build_character_interview_system_prompt",
    "build_interview_summary_prompt",
    "build_panel_interview_system_prompt",
    "build_story_summary_prompt",
    "build_scene_summary_prompt",
    "build_structure_section_summary_prompt",
    "build_character_arc_prompt",
    "build_economy_analysis_prompt",
    "build_session_recap_prompt",
    "build_attribute_generation_prompt",
    "build_relationship_suggestion_prompt",
    "build_scene_chat_system_prompt",
    "build_brainstorm_system_prompt",
]
