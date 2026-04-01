from ...models.character import Character


def build_character_interview_system_prompt(character: Character) -> str:
    """
    Constructs the system prompt for a character interview.
    The character becomes the LLM's persona — it IS the character.
    """
    parts = [f"You are {character.name}."]

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

    parts.append(
        "\n\nYou are being interviewed by your author. "
        "Answer honestly and earnestly as yourself, drawing from your experiences and personality. "
        "Stay in character. Speak in first person. "
        "Do not break character or acknowledge that you are an AI."
    )

    return "\n".join(parts)
