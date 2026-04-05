"""
Discovery prompts — extract story elements from prose for the Discovery Queue.
"""


def build_discovery_prompt(
    prose: str,
    element_types: list[str],
    existing_characters: list[str],
    existing_settings: list[str],
) -> str:
    """
    Prompt to identify new story elements in a prose passage.
    Returns structured JSON that the router parses into DiscoveredElement records.
    """
    type_descriptions = {
        "character": "named people or beings who appear or are mentioned",
        "setting": "named locations, places, or environments described",
        "relationship": "connections or dynamics between characters revealed through dialogue or action",
        "theme": "recurring ideas, motifs, or thematic concerns that surface",
        "object": "significant named objects or artifacts with story importance",
    }
    requested = [f'"{t}" — {type_descriptions[t]}' for t in element_types if t in type_descriptions]

    existing_chars_text = (
        f"Already in Lorebook (do NOT re-suggest these): {', '.join(existing_characters)}"
        if existing_characters else "No characters are in the Lorebook yet."
    )
    existing_settings_text = (
        f"Already in Lorebook (do NOT re-suggest these): {', '.join(existing_settings)}"
        if existing_settings else "No settings are in the Lorebook yet."
    )

    return f"""You are a story analysis assistant reading prose written by an author who is discovering their story as they write.

Your task: identify new story elements in this scene that the author may want to add to their Lorebook.

WHAT TO LOOK FOR:
{chr(10).join(f"- {r}" for r in requested)}

CHARACTERS — {existing_chars_text}
SETTINGS — {existing_settings_text}

PROSE TO ANALYZE:
{prose}

INSTRUCTIONS:
- Only surface elements that feel genuinely significant or intentional — not passing mentions
- For relationships, describe the dynamic revealed (e.g. "protective older sibling dynamic", "unspoken rivalry")
- For themes, name the idea concisely (e.g. "redemption through sacrifice", "cost of ambition")
- Assign a confidence score from 0.0 to 1.0 — higher for prominent, clearly named elements; lower for implied or ambiguous ones
- Include a short source_excerpt (1–2 sentences from the prose) that most clearly reveals this element
- If nothing significant is found for a type, omit it entirely

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "discoveries": [
    {{
      "element_type": "character",
      "name": "Elena Marsh",
      "description": "A lighthouse keeper who appears guarded but clearly knows more than she lets on.",
      "confidence": 0.9,
      "source_excerpt": "The woman at the door — Elena, she said, though she didn't offer a last name — watched him with the careful eyes of someone who has learned not to trust strangers."
    }}
  ]
}}

If nothing meaningful was found, respond with: {{"discoveries": []}}"""
