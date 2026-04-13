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
) -> str:
    scenes_text = "\n".join(
        f"- [{s['id']}] {s['title']}: {s.get('synopsis', '')}" for s in scenes
    )
    existing_text = ""
    if existing_events:
        existing_text = "\n\nAlready logged events (do not duplicate):\n" + "\n".join(
            f"- {e['subject']} ({e['knowledge_type']}) at node {e.get('node_id', 'unlinked')}"
            for e in existing_events
        )

    return f"""Story: "{story_title}"

Scenes (id | title | synopsis):
{scenes_text}
{existing_text}

Analyze the scenes and identify reader knowledge events. For each event return:
- node_id: scene ID where the event occurs (or null if it spans the story)
- knowledge_type: one of truth_revealed | misdirection_planted | clue_planted | character_learns | reader_only
- subject: short label (e.g. "Marcus is the killer")
- detail: 1-2 sentence description
- reader_knows: true if the reader knows this at this point
- characters_who_know: list of character names (not IDs) who know this
- is_truth: true if this is factual story truth, false if it is misdirection

Return JSON: {{"events": [{{...}}, ...]}}"""
