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
}


__all__ = [
    "CORE_SYSTEM_PROMPT",
    "FEATURE_LABELS",
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
]
