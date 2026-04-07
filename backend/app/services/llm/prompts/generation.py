"""
Generation prompts — attribute suggestions, relationship suggestions, character journey.
"""

from ....models.character import Character


def build_attribute_generation_prompt(character: Character, attribute_type: str) -> str:
    """Prompt to suggest character attributes based on existing profile."""
    existing = []
    if character.personality:
        existing.append(f"Personality: {character.personality}")
    if character.motivation:
        existing.append(f"Motivation: {character.motivation}")
    if character.background:
        existing.append(f"Background: {character.background}")
    if character.appearance:
        existing.append(f"Appearance: {character.appearance}")
    if character.traits:
        existing.append(f"Traits: {', '.join(f'{k}: {v}' for k, v in character.traits.items())}")
    if character.arc_notes:
        existing.append(f"Arc notes: {character.arc_notes}")

    profile = "\n".join(existing) if existing else "No profile information yet."

    type_prompts = {
        "traits": "Suggest 5 distinctive character traits as key: value pairs (e.g. 'stubbornness: refuses to back down even when wrong'). Make them specific and narratively interesting.",
        "backstory": "Suggest 3-5 specific backstory elements: formative events, relationships, or experiences that shaped this character. Be concrete and evocative.",
        "quirks": "Suggest 4-6 behavioral quirks, habits, or mannerisms that make this character distinctive and memorable in scenes.",
        "appearance": "Suggest a vivid, specific physical description that reflects the character's personality and life experiences. 2-3 paragraphs.",
    }

    type_instruction = type_prompts.get(attribute_type, f"Suggest attributes for: {attribute_type}")

    return (
        f"You are helping an author develop the character {character.name} (role: {character.role}).\n\n"
        f"Existing profile:\n{profile}\n\n"
        f"Task: {type_instruction}\n\n"
        "Be specific and vivid. Avoid generic descriptions. "
        "Suggestions should feel organic given the character's existing profile.\n\n"
        "Respond with a JSON object matching this exact schema:\n"
        '{\n'
        '  "suggestions": [\n'
        '    {"text": "the suggestion text", "rationale": "brief reason why this fits the character"},\n'
        '    ...\n'
        '  ]\n'
        '}\n\n'
        "Rules:\n"
        "- Output ONLY valid JSON. No markdown, no extra text before or after.\n"
        "- Each suggestion: text is the concrete suggestion, rationale is 1 sentence explaining why it fits.\n"
        "- Include the number of suggestions specified in the task above."
    )


def build_relationship_suggestion_prompt(characters: list[Character], existing: list[dict]) -> str:
    """Prompt to suggest character relationships."""
    char_profiles = []
    for c in characters:
        desc = f"- {c.name} ({c.role})"
        if c.personality:
            desc += f": {c.personality[:120]}"
        char_profiles.append(desc)

    existing_lines = [f"  {e['from']} → {e['to']}: {e['type']}" for e in existing] if existing else ["  (none yet)"]

    return (
        "You are helping an author develop character relationships.\n\n"
        f"Characters:\n" + "\n".join(char_profiles) + "\n\n"
        f"Existing relationships:\n" + "\n".join(existing_lines) + "\n\n"
        "Suggest 3-5 interesting relationship dynamics between these characters.\n\n"
        "Respond with a JSON object matching this exact schema:\n"
        '{\n'
        '  "suggestions": [\n'
        '    {\n'
        '      "character_a": "exact name from the list above",\n'
        '      "character_b": "exact name from the list above",\n'
        '      "relationship_type": "e.g. mentor/student, rivals, old friends, secret admirers",\n'
        '      "description": "1-2 sentence description of the dynamic and its narrative potential"\n'
        '    },\n'
        '    ...\n'
        '  ]\n'
        '}\n\n'
        "Rules:\n"
        "- Output ONLY valid JSON. No markdown, no extra text before or after.\n"
        "- Use exact character names as they appear in the list above.\n"
        "- Focus on relationships with narrative tension or interesting complexity.\n"
        "- 3-5 suggestions total."
    )
