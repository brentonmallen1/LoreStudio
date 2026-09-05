"""
Outline-related LLM prompts.

- build_extract_outline_prompt: extract a proposed outline from existing manuscript
- build_outline_alignment_prompt: compare an existing outline against manuscript prose
"""


def build_extract_outline_prompt(
    story_title: str,
    story_intent: str | None,
    genre: str | None,
    scenes_with_content: list[str],  # ["[Scene Title]\n{excerpt}"]
    total_words: int,
) -> str:
    """
    Prompt to analyze manuscript prose and generate a proposed outline.
    Identifies major plot beats, character arc moments, structural divisions.
    """
    return f"""You are a literary editor helping an author retroactively outline their story "{story_title}".

Genre: {genre or "Not specified"}
Story intent: {story_intent or "Not specified"}
Total words written: {total_words:,}

SCENES IN ORDER (with content excerpts):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

Read these scenes and identify the major structural beats, plot events, character arc moments, and thematic turns. Generate a proposed outline the author can review and import.

Respond with this exact JSON schema:

{{
  "suggested_name": "A short name for this outline (e.g. 'Extracted from Manuscript')",
  "items": [
    {{
      "text": "The beat or outline item text — specific and grounded in the prose",
      "beat_type": "plot | character | theme | setting",
      "suggested_scene_id": "",
      "suggested_scene_title": "The scene title this beat was found in, if identifiable",
      "confidence": 0.9,
      "reasoning": "One sentence: why this is a significant beat"
    }}
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Generate 8-20 beats that represent the real structure of the written story.
- beat_type: use "plot" for story events, "character" for arc/growth moments, "theme" for thematic beats, "setting" for world-establishment moments.
- confidence: 0.5-1.0. Use lower confidence for inferred beats vs clear ones.
- suggested_scene_id: leave empty string "" — the frontend will match on scene title.
- suggested_scene_title: exact scene title from the list above, or "" if it spans multiple scenes.
- Focus on what IS written, not what should be written."""


def build_outline_alignment_prompt(
    story_title: str,
    outline_name: str,
    outline_items: list[str],  # ["Act 1: Opening", "  - The protagonist arrives", ...]
    scenes_with_content: list[str],  # ["[Scene Title]\n{excerpt}"]
) -> str:
    """
    Prompt to compare an existing outline against written manuscript prose.
    Reports covered beats, missing beats, unplanned content, and divergences.
    """
    return f"""You are a developmental editor comparing an author's outline against their written manuscript for "{story_title}".

OUTLINE "{outline_name}":
{chr(10).join(outline_items) if outline_items else "Outline is empty."}

WRITTEN SCENES IN ORDER (with excerpts):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

For each outline beat, determine whether it appears in the manuscript. Also identify manuscript content not represented in the outline.

Respond with this exact JSON schema:

{{
  "covered_beats": [
    {{
      "outline_text": "Exact text of the outline item",
      "status": "covered | partial",
      "evidence": "What in the manuscript covers or partially covers this beat",
      "scene_references": ["Scene Title A", "Scene Title B"]
    }}
  ],
  "missing_beats": [
    {{
      "outline_text": "Exact text of the outline item",
      "status": "missing",
      "evidence": "Why this beat doesn't appear to be in the manuscript yet",
      "scene_references": []
    }}
  ],
  "unplanned_content": [
    "A description of manuscript content or story development not represented in the outline"
  ],
  "divergences": [
    "Where the prose went a meaningfully different direction than what the outline planned"
  ],
  "recommendations": [
    "A specific, actionable suggestion for the author based on what was found"
  ],
  "coverage_score": 75
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- coverage_score: 0-100, percentage of outline beats found (covered + partial) in the manuscript.
- Only include items in covered_beats/missing_beats that are actual outline beats (not structural headers).
- unplanned_content: focus on significant story developments, not every small scene.
- divergences: only list meaningful directional changes, not minor differences.
- Be generous with "covered" — if the spirit of the beat is there, count it."""
