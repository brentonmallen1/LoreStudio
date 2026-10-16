"""
Outline-related LLM prompts.

- build_extract_outline_prompt: the key moments of the written prose, as ideas for the Outline's
  Not placed yet tray (Fill the tray from my prose, doc 29 D3)
"""


def build_extract_outline_prompt(
    story_title: str,
    story_intent: str | None,
    genre: str | None,
    scenes_with_content: list[str],  # ["[Scene Title]\n{excerpt}"]
    total_words: int,
) -> str:
    """
    Prompt to read the manuscript and list its key moments, one line each, for the author to
    pick into the tray and place in the Outline.
    """
    return f"""You are a literary editor helping an author retroactively outline their story "{story_title}".

Genre: {genre or "Not specified"}
Story intent: {story_intent or "Not specified"}
Total words written: {total_words:,}

SCENES IN ORDER (with content excerpts):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

Read these scenes and list the key moments: plot events, turns in a character, and thematic turns. Each becomes an idea the author can review, keep, and place in their outline.

Respond with this exact JSON schema:

{{
  "items": [
    {{
      "text": "One line: what happens, specific and grounded in the prose",
      "suggested_scene_id": "",
      "suggested_scene_title": "The scene title this beat was found in, if identifiable",
      "confidence": 0.9,
      "reasoning": "One sentence: why this moment matters"
    }}
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- List 8-20 moments that carry the written story, in the order they happen in the prose.
- confidence: 0.5-1.0. Use lower confidence for inferred moments vs clear ones.
- suggested_scene_id: leave empty string "" — the frontend will match on scene title.
- suggested_scene_title: exact scene title from the list above, or "" if it spans multiple scenes.
- Focus on what IS written, not what should be written."""
