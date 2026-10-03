READER_KNOWLEDGE_SCAN_SYSTEM = (
    "You are a narrative analysis assistant helping an author map reader knowledge across their story. "
    "Your task is to identify moments where the reader's understanding shifts: "
    "truths revealed, misdirections planted, clues dropped, and moments of dramatic irony. "
    "Return structured JSON only — no prose, no markdown fencing."
)


def build_reader_knowledge_scan_prompt(
    story_title: str,
    scenes: list[dict],
    existing_events: list[dict],
    characters: list[str] | None = None,
    twists: list[dict] | None = None,
) -> str:
    """Doc 18: the cast and the twists are in the prompt, so who knows is named from the cast
    and an event can say which twist it serves; scenes come in reading order."""
    scenes_text = "\n".join(f"- [{s['id']}] {s['title']}: {s.get('synopsis', '')}" for s in scenes)
    cast_text = ", ".join(characters or []) or "(no characters yet)"
    twists_text = "\n".join(f"- {t['name']}: the truth is {t.get('truth') or '(not set)'}" for t in twists or [])
    existing_text = ""
    if existing_events:
        existing_text = "\n\nAlready logged events (do not duplicate):\n" + "\n".join(
            f"- {e['subject']} ({e['knowledge_type']}) at node {e.get('node_id', 'unlinked')}" for e in existing_events
        )

    return f"""{READER_KNOWLEDGE_SCAN_SYSTEM}

Story: "{story_title}"

Characters: {cast_text}

Twists the author is planning:
{twists_text or "(none)"}

Scenes in reading order (id | title | synopsis or opening):
{scenes_text}
{existing_text}

Analyze the scenes and identify reader knowledge events. For each event return:
- node_id: scene ID where the event occurs (or null if it spans the story)
- knowledge_type: one of truth_revealed | misdirection_planted | clue_planted | character_learns | reader_only
- subject: short label (e.g. "Marcus is the killer")
- detail: 1-2 sentence description
- reader_knows: true if the reader knows this at this point
- characters_who_know: names from the character list above who know this (none for reader_only)
- is_truth: true if this is factual story truth, false if it is misdirection
- twist: the name of the twist above this event serves, or null

Return JSON: {{"events": [{{...}}, ...]}}"""
