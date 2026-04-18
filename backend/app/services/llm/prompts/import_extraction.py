"""
Prompts for entity extraction during manuscript import.

Each prompt receives a name and relevant prose excerpts, and returns
structured JSON to populate Lorebook data models.
"""


def _role_hint(occurrences: int) -> str:
    if occurrences <= 3:
        return "With only a few mentions, this is likely a tertiary or minor character."
    if occurrences <= 10:
        return "With moderate mentions, this is likely a supporting character."
    if occurrences <= 25:
        return "With many mentions, this is likely a deuteragonist or major supporting character."
    return "With frequent mentions throughout, this is likely a protagonist or central character."


def build_character_extraction_prompt(
    name: str,
    occurrences: int,
    excerpts: list[str],
) -> str:
    excerpts_text = "\n---\n".join(excerpts) if excerpts else "(no excerpts available)"
    return f"""You are analyzing a manuscript to extract details about a character.

CHARACTER NAME: {name}
TOTAL MENTIONS: {occurrences}
ROLE GUIDANCE: {_role_hint(occurrences)}

PROSE EXCERPTS (passages where this character appears):
---
{excerpts_text}
---

Based ONLY on what is shown in these excerpts, extract character details.
Do not invent or assume anything not supported by the text.

Return valid JSON in this exact format (no markdown, no extra text):
{{
  "role": "protagonist|deuteragonist|antagonist|supporting|tertiary",
  "personality": "2-3 sentences about personality traits shown in the text",
  "motivation": "What drives this character, if revealed",
  "appearance": "Physical description, if provided in the text",
  "background": "Any backstory explicitly revealed",
  "confidence": 0.0
}}

Rules:
- role: use the ROLE GUIDANCE above as a strong prior; override only if the text clearly contradicts it
- Leave a field as empty string "" if not enough evidence exists
- confidence: 0.0–1.0 based on how much information is available (0.3 for a name mention only, 0.9 for a major recurring character)
- Do not fabricate details — only extract what the text shows"""


def build_location_extraction_prompt(
    name: str,
    occurrences: int,
    excerpts: list[str],
) -> str:
    excerpts_text = "\n---\n".join(excerpts) if excerpts else "(no excerpts available)"
    return f"""You are analyzing a manuscript to extract details about a location.

LOCATION NAME: {name}
TOTAL MENTIONS: {occurrences}

PROSE EXCERPTS (passages where this location appears):
---
{excerpts_text}
---

Based ONLY on what is shown in these excerpts, extract location details.
Do not invent or assume anything not supported by the text.

Return valid JSON in this exact format (no markdown, no extra text):
{{
  "location_type": "settlement|structure|natural_feature|region|landmark|vessel|other",
  "description": "Physical description of the place from the text",
  "atmosphere": "Mood or feeling evoked by this location",
  "significance": "Why this place matters to the story, if apparent",
  "confidence": 0.0
}}

Rules:
- Leave a field as empty string "" if not enough evidence exists
- confidence: 0.0–1.0 based on how much detail is provided
- Do not fabricate details — only extract what the text shows"""


def build_relationship_extraction_prompt(
    char_a: str,
    char_b: str,
    excerpts: list[str],
) -> str:
    excerpts_text = "\n---\n".join(excerpts) if excerpts else "(no excerpts available)"
    return f"""You are analyzing a manuscript to determine the relationship between two characters.

CHARACTER A: {char_a}
CHARACTER B: {char_b}

PROSE EXCERPTS (scenes where both characters appear):
---
{excerpts_text}
---

Based ONLY on what is shown in these excerpts, describe the relationship between {char_a} and {char_b}.

Return valid JSON in this exact format (no markdown, no extra text):
{{
  "relationship_type": "family|romantic|friendship|professional|rival|mentor|acquaintance|enemy|other",
  "description": "A sentence or two describing the nature of their relationship",
  "role_influence": "How this relationship affects each character's narrative role, if apparent (e.g., 'B serves as A\\'s foil', 'A mentors B', 'rivals who mirror each other'). Empty string if unclear.",
  "confidence": 0.0
}}

Rules:
- Leave description or role_influence as empty string "" if not enough evidence exists
- confidence: 0.0–1.0 based on how clearly the relationship is established
- Only extract what the text explicitly shows — do not speculate"""
