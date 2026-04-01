from ...models.character import Character


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
        "Suggestions should feel organic given the character's existing profile. "
        "Format as a numbered list."
    )


def build_story_summary_prompt(title: str, intent: str, nodes_content: list[dict], up_to_title: str | None, style: str) -> str:
    """Prompt to summarize the story up to a given point."""
    content_text = "\n\n".join(
        f"[{n['title']}]\n{n['content']}" for n in nodes_content if n.get("content")
    )
    if not content_text:
        return f"The story '{title}' has no written content yet."

    scope = f"up to and including '{up_to_title}'" if up_to_title else "the entire story so far"
    detail = "concise (3-5 sentences)" if style == "brief" else "detailed (several paragraphs)"

    intent_line = f"\nThe author's stated intent: {intent}\n" if intent else ""

    return (
        f"You are a literary assistant summarizing the story '{title}'.{intent_line}\n"
        f"Provide a {detail} summary of {scope}.\n\n"
        f"Story content:\n{content_text}\n\n"
        "Focus on plot, character actions, and key developments. Write in present tense."
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
        "Suggest 3-5 interesting relationship dynamics between these characters. "
        "For each suggestion provide:\n"
        "- Character A name\n"
        "- Character B name\n"
        "- Relationship type (e.g. mentor/student, rivals, old friends, secret admirers)\n"
        "- A 1-2 sentence description of the dynamic and its narrative potential\n\n"
        "Format as a numbered list. Focus on relationships with narrative tension or interesting complexity."
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
        "- Each character should respond authentically to their own personality and motivations\n"
        "- Characters may agree, disagree, or react to each other's responses\n"
        "- Stay in character for all responses\n"
        "- Do not break character or acknowledge that you are an AI\n\n"
        "The author is interviewing all of these characters together. "
        "Every response must include a reply from each character."
    )


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
