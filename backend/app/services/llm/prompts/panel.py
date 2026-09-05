"""
Panel interview prompts — multi-call architecture.

Each character gets their own LLM call with their full persona prompt (identical to
single-character interviews) plus room context: who else is present, relationships,
and a history labeled by speaker so each character knows exactly who said what.
"""

from ....models.character import Character, CharacterRelationship
from .interviews import (
    _CHARACTER_TYPE_GUIDANCE,
    _JUNGIAN_GUIDANCE,
    _NARRATIVE_GUIDANCE,
    _ROLE_GUIDANCE,
    _build_attribute_guidance,
    _normalise,
)


def _relationship_summary(
    character: Character,
    other: Character,
    relationships: list[CharacterRelationship],
) -> str:
    """Build a one-line relationship description from character's perspective."""
    rel = next(
        (r for r in relationships if r.character_id == character.id and r.related_character_id == other.id),
        None,
    )
    if not rel:
        rel = next(
            (r for r in relationships if r.character_id == other.id and r.related_character_id == character.id),
            None,
        )
    if not rel:
        return f"{other.name} — no established relationship"

    parts = []
    if rel.description:
        parts.append(rel.description)
    if rel.strength:
        trust = rel.strength.get("trust")
        affection = rel.strength.get("affection")
        if trust is not None:
            parts.append(f"trust: {trust}/10")
        if affection is not None:
            parts.append(f"affection: {affection}/10")
    if rel.narrative_purpose:
        parts.append(f"dynamic: {', '.join(rel.narrative_purpose)}")

    return f"{other.name} — {'; '.join(parts)}" if parts else f"{other.name}"


def format_history_with_labels(messages: list[dict]) -> str:
    """
    Convert panel messages to a labeled transcript.
    Each line is clearly attributed: [Author], [CharacterName], etc.
    """
    lines = []
    for m in messages:
        role = m.get("role", "")
        content = m.get("content", "").strip()
        if not content:
            continue
        if role == "user":
            lines.append(f"[Author]: {content}")
        elif role == "character":
            name = m.get("character_name") or "Character"
            lines.append(f"[{name}]: {content}")
    return "\n".join(lines) if lines else "(No conversation yet)"


def build_panel_orchestrator_prompt(
    characters: list[Character],
    conversation_history: list[dict],
    current_round: int,
    max_rounds: int,
) -> str:
    """
    Non-streaming call that decides which characters speak and in what order.
    Returns JSON: {"speakers": [...], "round_complete": bool}
    """
    char_summaries = []
    for c in characters:
        meta = []
        if c.role:
            meta.append(c.role)
        if c.personality:
            meta.append(c.personality[:80])
        if c.motivation:
            meta.append(f"driven by: {c.motivation[:60]}")
        char_summaries.append(f"- {c.name}: {'; '.join(meta)}")

    char_block = "\n".join(char_summaries)
    history_text = format_history_with_labels(conversation_history)
    names_str = ", ".join(c.name for c in characters)

    round_note = ""
    if current_round > 1:
        round_note = (
            f"\nThis is round {current_round} of {max_rounds}. "
            "Only include characters who genuinely want to react to what was just said. "
            "It is fine to return an empty speakers list if the exchange feels naturally complete."
        )

    return (
        f"You are a conversation facilitator. The author is interviewing these characters together:\n{char_block}\n\n"
        f"Recent conversation:\n{history_text}\n\n"
        f"Characters: {names_str}{round_note}\n\n"
        "Decide:\n"
        "1. Which characters have something meaningful to say RIGHT NOW (can be none)\n"
        "2. The most natural speaking order (most relevant/emotionally invested first)\n"
        "3. Whether this exchange feels naturally complete, or if characters are likely to react to each other\n\n"
        'Return JSON only: {"speakers": ["Name1", "Name2"], "round_complete": true}\n'
        "- speakers: ordered list of character names who want to speak (empty list is valid)\n"
        "- round_complete: true if the exchange feels done, false if characters may want to react"
    )


def build_panel_character_prompt(
    character: Character,
    other_characters: list[Character],
    relationships: list[CharacterRelationship],
    journey_summary: str | None = None,
    response_length: str | None = None,
) -> str:
    """
    Full character persona prompt (equivalent to single-character interview) plus
    room context: who else is present and what the relationship dynamic is.
    """
    parts = [f"You are {character.name}."]

    if character.mission_statement:
        parts.append(f"\nYour core drive: {character.mission_statement}")
    if character.personality:
        parts.append(f"\nYour personality: {character.personality}")
    if character.motivation:
        parts.append(f"\nYour motivation: {character.motivation}")
    if character.background:
        parts.append(f"\nYour background: {character.background}")
    if character.appearance:
        parts.append(f"\nYour appearance: {character.appearance}")
    if character.traits:
        trait_lines = "\n".join(f"  - {k}: {v}" for k, v in character.traits.items())
        parts.append(f"\nYour traits:\n{trait_lines}")

    if character.attributes:
        attr_guidance = _build_attribute_guidance(character.attributes)
        if attr_guidance:
            parts.append(f"\n\nHow you speak, think, and carry yourself:\n{attr_guidance}")

    classification_lines: list[str] = []
    role_key = _normalise(character.role or "")
    role_match = next((v for k, v in _ROLE_GUIDANCE.items() if _normalise(k) == role_key), None)
    if role_match:
        classification_lines.append(role_match)
    char_type_key = _normalise(getattr(character, "character_type", "") or "")
    char_type_match = next((v for k, v in _CHARACTER_TYPE_GUIDANCE.items() if _normalise(k) == char_type_key), None)
    if char_type_match:
        classification_lines.append(char_type_match)
    jungian_key = _normalise(getattr(character, "jungian_archetype", "") or "")
    jungian_match = next((v for k, v in _JUNGIAN_GUIDANCE.items() if _normalise(k) == jungian_key), None)
    if jungian_match:
        classification_lines.append(jungian_match)
    narrative_key = _normalise(getattr(character, "narrative_archetype", "") or "")
    narrative_match = next((v for k, v in _NARRATIVE_GUIDANCE.items() if _normalise(k) == narrative_key), None)
    if narrative_match:
        classification_lines.append(narrative_match)
    if classification_lines:
        parts.append("\n\nYour place in the story:\n" + "\n".join(classification_lines))

    if journey_summary:
        parts.append(
            f"\n\nWhat you have experienced so far in the story:\n{journey_summary}\n"
            "Respond with awareness of these events — they are part of your lived experience."
        )

    # Room context
    if other_characters:
        room_lines = []
        for other in other_characters:
            rel_text = _relationship_summary(character, other, relationships)
            room_lines.append(f"  - {rel_text}")
        parts.append(
            "\n\n--- GROUP CONVERSATION ---\n"
            "You are speaking with the author and the following characters:\n"
            + "\n".join(room_lines)
            + "\n\nThe author is moderating this conversation."
        )

    length_instruction = ""
    if response_length == "brief":
        length_instruction = "\n\nKeep your response short — 2 to 3 sentences maximum. Be direct and natural."
    elif response_length == "detailed":
        length_instruction = "\n\nYou may respond at length if the moment calls for it."
    # "normal" or None: no instruction — let character voice decide naturally

    parts.append(
        "\n\nYou are having a real conversation — not performing. "
        "Speak as yourself. React to what has actually been said. "
        "You may address the author directly, respond to what another character said, or both.\n\n"
        "The conversation history below uses [Author] for the author's messages and "
        "[CharacterName] for each character's messages — read it carefully so you know who said what.\n\n"
        "Speak in first person. Be yourself. "
        "When asked what you would do or say in a scene, speak from the inside — "
        "your gut reaction, the pull between what you want and what you know. "
        "Use 'I'd probably...' or 'I honestly don't know if I could...' rather than acting it out.\n\n"
        "You may use a single bracketed action cue when it captures something words genuinely can't: "
        "a hesitation, a physical tell, a moment of emotion. Think of it as punctuation, not decoration. "
        "Aim for no more than one every several exchanges, and never more than one per response. "
        "Default to just speaking." + length_instruction + "\n\n"
        "If you truly have nothing meaningful to add to this moment, respond with exactly: [pass]\n\n"
        "Stay in character. Do not acknowledge that you are an AI."
    )

    return "\n".join(parts)
