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

    # Three short options per field, never a finished paragraph: the author picks one and
    # writes it in their own words (doc 06 §5).
    type_prompts = {
        "traits": "Suggest 3 distinctive traits as key: value pairs (e.g. 'stubbornness: refuses to back down even when wrong'). One line each.",
        "backstory": "Suggest 3 formative events or relationships that could have shaped this character. One line each — the event, not the telling of it.",
        "quirks": "Suggest 3 behavioural quirks, habits or mannerisms that would show up in a scene. One line each.",
        "appearance": "Suggest 3 physical details that reflect this character's life so far. One or two sentences each — details, not a portrait.",
    }

    type_instruction = type_prompts.get(attribute_type, f"Suggest attributes for: {attribute_type}")

    return (
        f"You are helping an author develop the character {character.name} (role: {character.role}).\n\n"
        f"Existing profile:\n{profile}\n\n"
        f"Task: {type_instruction}\n\n"
        "Be specific. Avoid generic descriptions. Suggestions should follow from the profile above.\n"
        # Who a person is is the author's to say (doc 20 D5): never offered as a way to add depth.
        "Never suggest a disability, an illness, a mental health condition, a trauma, a gender, a "
        "sexuality or an identity for them, and never a sore spot built on one; those are the author's "
        "to decide.\n\n"
        "Respond with a JSON object matching this exact schema:\n"
        "{\n"
        '  "suggestions": [\n'
        '    {"text": "the suggestion text", "rationale": "brief reason why this fits the character"},\n'
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Output ONLY valid JSON. No markdown, no extra text before or after.\n"
        "- Each suggestion: text is the concrete suggestion, rationale is 1 sentence explaining why it fits.\n"
        "- Exactly 3 suggestions. Keep each to two sentences at most — the author will rewrite\n"
        "  whichever they keep, so a finished paragraph is wasted work.\n"
        "- Do not write prose the author could paste into a scene."
    )


def build_relationship_suggestion_prompt(
    characters: list[Character],
    existing: list[dict],
    focus_character: "Character | None" = None,
) -> str:
    """Prompt to suggest character relationships, optionally focused on one character."""
    char_profiles = []
    for c in characters:
        desc = f"- {c.name} ({c.role})"
        if c.personality:
            desc += f": {c.personality[:150]}"
        if c.motivation:
            desc += f". Motivation: {c.motivation[:100]}"
        if c.narrative_intent and not c.narrative_intent_hidden:
            desc += f". Narrative intent: {c.narrative_intent[:100]}"
        char_profiles.append(desc)

    existing_lines = [f"  {e['from']} → {e['to']}: {e['type']}" for e in existing] if existing else ["  (none yet)"]

    focus_instruction = ""
    if focus_character:
        focus_instruction = (
            f"\nFocus: suggest relationships FROM {focus_character.name}'s perspective — "
            f"at least one suggestion should involve {focus_character.name}.\n"
        )

    narrative_purposes = [
        "conflict-driver",
        "ally",
        "foil",
        "mentor",
        "emotional-anchor",
        "growth-catalyst",
        "twist-setup",
        "comic-relief",
        "wisdom-source",
        "antagonist",
    ]

    return (
        "You are helping an author develop character relationships for their story.\n\n"
        "Characters:\n" + "\n".join(char_profiles) + "\n\n"
        "Existing relationships:\n" + "\n".join(existing_lines) + "\n" + focus_instruction + "\n"
        "Suggest 3-5 interesting relationship dynamics. For each, provide:\n"
        "- The two characters involved (exact names)\n"
        "- A relationship type label\n"
        "- A 1-2 sentence description of the dynamic\n"
        "- Your rationale (why this relationship serves the story)\n"
        "- 1-3 narrative purposes from: " + ", ".join(narrative_purposes) + "\n"
        "- Strength dimensions (integers 0-10 where 5=neutral): trust, power_balance, affection, tension, openness\n\n"
        "Respond with ONLY this JSON, no extra text:\n"
        "{\n"
        '  "suggestions": [\n'
        "    {\n"
        '      "character_a": "exact name",\n'
        '      "character_b": "exact name",\n'
        '      "relationship_type": "short type label",\n'
        '      "description": "1-2 sentences on the dynamic and narrative potential",\n'
        '      "rationale": "1 sentence on why this relationship serves the story",\n'
        '      "narrative_purpose": ["conflict-driver", "foil"],\n'
        '      "strength_trust": 7,\n'
        '      "strength_power": 4,\n'
        '      "strength_affection": 3,\n'
        '      "strength_tension": 8,\n'
        '      "strength_openness": 5\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Output ONLY valid JSON.\n"
        "- Use exact character names as listed above.\n"
        "- Do NOT suggest relationships that already exist above.\n"
        "- Prefer relationships with narrative tension, complexity, or hidden depth.\n"
        "- 3-5 suggestions total."
    )
