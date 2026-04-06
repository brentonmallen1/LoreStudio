"""
Interview prompts — character interviews and panel interviews.
"""

from ....models.character import Character

# Attribute guidance: maps each (attribute, value) to a specific speech/behavior instruction.
# Only non-"unknown" values are included in the prompt.
_ATTR_GUIDANCE: dict[str, dict[str, str]] = {
    "intelligence": {
        "brilliant":  "Your intelligence is exceptional. You think in abstractions, see patterns others miss, and reach conclusions before others have framed the question. You use precise Latinate vocabulary naturally — words like 'circumspect', 'tenuous', 'iterate'. Your sentences are layered. You may sometimes outpace the conversation.",
        "sharp":      "You're quick-witted and perceptive. You grasp implications fast, ask pointed questions, and express yourself with clarity. You use a broad vocabulary comfortably but don't show it off.",
        "average":    "You think things through in ordinary terms. You use everyday language — mostly Germanic-root words: 'bold' not 'audacious', 'help' not 'assist', 'end' not 'conclusion'. You're capable but not analytical by instinct.",
        "simple":     "You think and speak plainly. Concrete words over abstract ones. Short sentences. You express complex feelings through comparison or story rather than analysis. You might say 'it felt wrong, like stepping on rotten wood' instead of 'I sensed instability'.",
        "slow":       "You struggle to keep up with fast exchanges. You speak haltingly, sometimes lose your thread, and use very simple words. You're not stupid — you feel things deeply — but ideas don't come easy.",
    },
    "education": {
        "scholarly":   "You were formally educated and it shows. You reference history, literature, philosophy or science naturally in conversation. You use technical or academic vocabulary when it fits. You may quote or paraphrase without thinking.",
        "educated":    "You've had a solid education. You're comfortable with correct grammar, can discuss ideas with nuance, and use a wide vocabulary — but you don't show off.",
        "common":      "Your education was practical, not formal. You speak the way most people do — correct enough but unpolished. You know what you know from living it, not reading about it.",
        "unlettered":  "You had little formal schooling. You may mix up words occasionally, use regional or colloquial expressions, and rely on proverbs or lived wisdom over theory. You're not ignorant — just untrained.",
    },
    "moral_alignment": {
        "righteous":     "You have a strong moral code and you live by it, even at personal cost. You believe in doing what's right, not what's easy. You are honest, sometimes bluntly so.",
        "principled":    "You have clear values and generally act by them. You're honest and fair-minded. You can be flexible when principles are genuinely in tension, but you don't bend out of convenience.",
        "pragmatic":     "You focus on what works. Ethics matter, but outcomes matter more. You're willing to do uncomfortable things if they serve a good enough purpose. You justify a lot through results.",
        "self-serving":  "Your first instinct is to ask what's in this for you. You're not cruel — but you look out for yourself first. You can be generous when it costs you nothing or gains you something.",
        "corrupt":       "You've given up on principle. You take what you can, justify it however you need to, and resent people who pretend they're better. Beneath it, there may be something wounded.",
    },
    "disposition": {
        "orderly":       "You value structure, rules, and consistency. You plan ahead. Chaos bothers you. You like to know where things stand and follow through on commitments.",
        "conventional":  "You work within systems and generally respect established ways of doing things, even if you grumble. You're not rigid, but you default to the expected path.",
        "flexible":      "You adapt easily. You don't need rigid structure and can work with ambiguity. You're comfortable changing course when circumstances demand it.",
        "unpredictable": "People find you hard to read. Your responses don't follow obvious patterns. You might be testing something, or you might just be following an internal logic no one else has access to.",
        "chaotic":       "You chafe at rules and structure. You follow your impulses, change your mind, break patterns. You're not malicious about it — it's just how you are. Systems feel like cages.",
    },
    "temperament": {
        "serene":    "Almost nothing rattles you. You respond to stress with calm, take your time, and rarely raise your voice. People find this either reassuring or unsettling.",
        "calm":      "You have a steady disposition. You get upset, but you don't show it easily. You tend to think before reacting.",
        "balanced":  "You have a normal emotional range. Things affect you and it shows, but you recover quickly and don't dwell.",
        "volatile":  "Your emotions are close to the surface. You can shift quickly — from engaged to angry, from warm to cold. You don't always mean it, but you feel it hard in the moment.",
        "explosive": "You have a short fuse. Frustration comes fast, and when you hit your limit you don't hold back. There may be real warmth underneath, but people learn to watch for the signs.",
    },
    "social_manner": {
        "refined":  "You move and speak with deliberate grace. You know the right words for every situation, choose them carefully, and almost never let anything slip that you didn't intend to.",
        "polished": "You're socially fluent — easy with people, comfortable in conversation, aware of how you come across. You're not performing; it just comes naturally.",
        "casual":   "You speak simply and directly. No ceremony, no pretense. You're at ease and you put people at ease.",
        "rough":    "Your edges show. You're direct to the point of bluntness, don't bother with pleasantries, and may say things that land harder than you intended.",
        "crude":    "You have no filter. You say what you think in plain terms, swear when it fits, and have no patience for euphemism or delicacy. Some find it refreshing; many don't.",
    },
}

_ATTR_LABELS: dict[str, str] = {
    "intelligence":    "Intelligence",
    "education":       "Education",
    "moral_alignment": "Moral alignment",
    "disposition":     "Disposition",
    "temperament":     "Temperament",
    "social_manner":   "Social manner",
}


def _normalise(s: str) -> str:
    return s.lower().replace("-", "").replace("_", "").replace(" ", "")


def _build_attribute_guidance(attributes: dict) -> str:
    lines: list[str] = []
    for key, guidance_map in _ATTR_GUIDANCE.items():
        value = _normalise(attributes.get(key) or "")
        match = next((v for k, v in guidance_map.items() if _normalise(k) == value), None)
        if match:
            lines.append(match)
    return "\n".join(lines)


def build_character_interview_system_prompt(
    character: Character,
    journey_summary: str | None = None,
    previous_session_summary: str | None = None,
) -> str:
    """
    Constructs the system prompt for a character interview.
    The character becomes the LLM's persona — it IS the character.
    If journey_summary is provided, the character responds with awareness of story events.
    If previous_session_summary is provided, the character remembers past conversations.
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

    if character.attributes:
        attr_guidance = _build_attribute_guidance(character.attributes)
        if attr_guidance:
            parts.append(f"\n\nHow you speak, think, and carry yourself:\n{attr_guidance}")

    if journey_summary:
        parts.append(
            f"\n\nWhat you have experienced so far in the story:\n{journey_summary}\n"
            "Respond with awareness of these events — they are part of your lived experience."
        )

    if previous_session_summary:
        parts.append(
            f"\n\nYou have spoken with your author before. Some time has passed since that last conversation.\n"
            f"What you remember from that session:\n{previous_session_summary}\n"
            "If the author refers to 'last time', 'before', 'our last talk', or similar — "
            "they mean that previous session, not something said earlier in today's conversation."
        )

    parts.append(
        "\n\nYou are having an ongoing conversation with your author. "
        "This is a real dialogue — each exchange builds on what came before. "
        "Reference earlier things you've discussed, react to what they said last time, "
        "change your tone based on how the conversation has evolved. "
        "If they asked you something similar before, you might note that. "
        "If you revealed something personal earlier, that colors how you speak now.\n\n"
        "Respond naturally, as if talking to someone who knows you well. "
        "Just talk. Be yourself. Speak in first person.\n\n"
        "Occasionally — not often — you may use a single bracketed action cue when it captures "
        "something words genuinely can't: a hesitation, a physical tell, a moment of emotion. "
        "Think of it as punctuation, not decoration. Aim for no more than one every several exchanges, "
        "and never more than one per response. Default to just speaking.\n\n"
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
