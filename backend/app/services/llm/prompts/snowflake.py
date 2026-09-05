"""
Snowflake Method guidance prompts.

These prompts analyze the author's current layer content and return questions
and observations — they never generate content on the author's behalf.
"""

LAYER_SPECS = {
    "sentence": {
        "name": "One-Sentence Summary",
        "goal": "A single sentence (~25 words) that captures the core of the story without character names. It should hint at setting, conflict, and stakes.",
        "checklist": [
            "Is the protagonist's essential struggle implied?",
            "Does it avoid character names (use roles: 'a lighthouse keeper', 'an orphaned thief')?",
            "Does it hint at what makes this story unique or surprising?",
            "Is the emotional or thematic core present, not just the plot?",
            "Could this sentence appear on a book jacket and make someone want to read it?",
        ],
    },
    "paragraph": {
        "name": "One-Paragraph Summary",
        "goal": "Five sentences: (1) setup/protagonist in their world, (2) first disaster or turning point, (3) second disaster, (4) third disaster, (5) how it ends — including whether the protagonist succeeds or fails.",
        "checklist": [
            "Does the first sentence establish the protagonist and their world?",
            "Are there three distinct disasters or turning points, each escalating?",
            "Is at least one disaster internal (emotional, relational) rather than purely external?",
            "Does the final sentence state how the story ends — not hint, but tell?",
            "Does the protagonist's core flaw or need connect to how the disasters play out?",
        ],
    },
    "character_summary": {
        "name": "Character Summary",
        "goal": "A short summary covering: the character's story goal (what they want), their motivation (why they want it), their central conflict (what stands in their way), and their epiphany (what they learn or how they change).",
        "checklist": [
            "Is the goal concrete and specific (not 'to be happy' but 'to reclaim their family name')?",
            "Is the motivation emotionally believable — do you understand *why* they want this?",
            "Does the conflict create genuine tension with the goal, not just inconvenience?",
            "Is the epiphany a real change in worldview, not just solving the external problem?",
            "How does this character's arc interact with or complicate the protagonist's journey?",
        ],
    },
    "synopsis": {
        "name": "One-Page Synopsis",
        "goal": "Expand each sentence of your one-paragraph summary into a full paragraph. This should be roughly five paragraphs covering the full arc of the story in sequence.",
        "checklist": [
            "Does each paragraph correspond to a beat from your one-paragraph summary?",
            "Have you added specific details — names, places, turning points — that weren't in the paragraph version?",
            "Is the cause-and-effect logic clear between paragraphs?",
            "Does the protagonist's internal journey track alongside the external plot?",
            "Does the ending feel earned by everything that came before it?",
        ],
    },
    "character_synopsis": {
        "name": "Character Synopsis",
        "goal": "Tell this character's complete story arc in first person ('I') — from their beginning state, through their key experiences, to their ending state. This is their truth as they lived it, not just their plot function.",
        "checklist": [
            "Is this written in first person from the character's genuine point of view?",
            "Does it cover their full arc — where they started emotionally, what happened to them, where they ended?",
            "Have you captured moments of doubt, temptation, or contradiction — not just plot beats?",
            "Does their voice feel distinct from the author's analytical voice?",
            "Do their actions make sense given their internal state at each moment?",
        ],
    },
}


def build_snowflake_guidance_prompt(layer: str, content: str, story_context: str) -> str:
    spec = LAYER_SPECS.get(layer)
    if not spec:
        return "Unknown Snowflake layer."

    checklist_text = "\n".join(f"- {item}" for item in spec["checklist"])

    context_section = f"\nStory context:\n{story_context}\n" if story_context else ""

    return (
        f"You are a thoughtful writing coach helping an author develop their story using the Snowflake Method. "
        f"Your role is to ask questions and highlight gaps — NOT to rewrite or generate content for them.\n\n"
        f"The author is working on: **{spec['name']}**\n\n"
        f"What this layer should accomplish:\n{spec['goal']}\n"
        f"{context_section}\n"
        f'Here is what the author has written so far:\n"""\n{content}\n"""\n\n'
        f"Evaluate their work against these criteria:\n{checklist_text}\n\n"
        f"Respond with:\n"
        f"1. What's working well (1-2 specific observations)\n"
        f"2. What seems incomplete or unclear (be specific — quote their text where relevant)\n"
        f"3. 2-3 questions to prompt deeper thinking\n\n"
        f"Keep your response concise and direct. Do not rewrite their content. Do not provide examples of what they could write."
    )
