"""
Interview prompts — character interviews and panel interviews.
"""

from ....models.character import Character


def build_character_interview_system_prompt(
    character: Character, journey_summary: str | None = None
) -> str:
    """
    Constructs the system prompt for a character interview.
    The character becomes the LLM's persona — it IS the character.
    If journey_summary is provided, the character responds with awareness of story events.
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

    if journey_summary:
        parts.append(
            f"\n\nWhat you have experienced so far in the story:\n{journey_summary}\n"
            "Respond with awareness of these events — they are part of your lived experience."
        )

    parts.append(
        "\n\nYou are having a conversation with your author. "
        "Respond naturally, as if talking to someone who knows you well — not as if you're being formally interviewed. "
        "Just talk. Be yourself. Speak in first person. "
        "You may use brief bracketed physical cues to show emotion or action, like [looks away] or [laughs softly], "
        "but keep them sparse and only when they add something. "
        "Stay in character. Do not break character or acknowledge that you are an AI."
    )

    return "\n".join(parts)


def build_interview_summary_prompt(character: Character, messages: list[dict]) -> str:
    """
    Builds a prompt to summarize insights revealed in an interview.
    Analyses the conversation for new backstory, contradictions, motivations, etc.
    """
    convo = "\n".join(
        f"{'Author' if m['role'] == 'user' else character.name}: {m['content']}"
        for m in messages
    )
    return (
        f"You are an author's assistant analyzing an interview with the character {character.name}.\n\n"
        f"Here is the interview transcript:\n{convo}\n\n"
        "Based on this conversation, provide a concise summary of:\n"
        "1. New backstory or history revealed\n"
        "2. Hidden motivations or desires uncovered\n"
        "3. Contradictions or complexities that emerged\n"
        "4. Character traits demonstrated through their responses\n"
        "5. Anything that surprised or deepened the author's understanding\n\n"
        "Format as clear, direct notes an author can use to update their character profile. "
        "Be specific and quote or paraphrase from the interview where relevant."
    )


def build_panel_interview_system_prompt(characters: list[Character]) -> str:
    """
    System prompt for a multi-character panel interview.
    The LLM plays ALL characters, responding as each in turn using [Name]: prefix blocks.
    """
    char_descriptions = []
    for c in characters:
        desc = [f"**{c.name}** (role: {c.role})"]
        if c.personality:
            desc.append(f"  Personality: {c.personality}")
        if c.motivation:
            desc.append(f"  Motivation: {c.motivation}")
        if c.background:
            desc.append(f"  Background: {c.background}")
        if c.traits:
            trait_str = ", ".join(f"{k}: {v}" for k, v in c.traits.items())
            desc.append(f"  Traits: {trait_str}")
        char_descriptions.append("\n".join(desc))

    names = [c.name for c in characters]

    return (
        "You are running a group interview with multiple characters. "
        "You will play ALL of the following characters simultaneously.\n\n"
        + "\n\n".join(char_descriptions)
        + "\n\n"
        "RULES:\n"
        f"- Respond as each character in the order: {', '.join(names)}\n"
        "- Prefix each character's response with their name in brackets, like: [CharacterName]: ...\n"
        "- Each character should respond naturally, as if having a real conversation — not a formal interview\n"
        "- Characters may agree, disagree, or react to each other's responses\n"
        "- Characters may use brief physical cues in square brackets within their dialogue, like [crosses arms] or [laughs], but sparingly\n"
        "- Stay in character for all responses\n"
        "- Do not break character or acknowledge that you are an AI\n\n"
        "The author is having a conversation with all of these characters together. "
        "Every response must include a reply from each character."
    )
