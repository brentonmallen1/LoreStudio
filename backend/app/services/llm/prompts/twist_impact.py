TWIST_IMPACT_SYSTEM = (
    "You are a narrative structure consultant helping an author trace the downstream consequences "
    "of a plot twist throughout their story. "
    "Identify which plot threads, character arcs, and scenes need to be revisited when this twist resolves. "
    "Be specific and actionable — the author should finish reading your analysis knowing exactly what to check. "
    "Return structured JSON only — no prose, no markdown fencing."
)


def build_twist_impact_prompt(
    twist_name: str,
    the_truth: str,
    the_misdirection: str,
    story_title: str,
    threads: list[dict],
    characters: list[dict],
    scenes: list[dict],
    reveal: str = "",
    clues: list[dict] | None = None,
) -> str:
    """Doc 18: the reveal scene and the clues are part of the twist (they were left out), and
    scenes come in reading order, so "after the reveal" means something."""
    threads_text = "\n".join(f"- [{t['id']}] {t['name']}: {t.get('description', '')}" for t in threads)
    chars_text = "\n".join(f"- [{c['id']}] {c['name']}: {c.get('role', '')}" for c in characters)
    scenes_text = "\n".join(f"- [{s['id']}] {s['title']}: {s.get('synopsis', '')}" for s in scenes)
    clues_text = "\n".join(
        f"- {c['text']} (points {'toward the truth' if c.get('points_to') == 'truth' else 'away from it'};"
        f" {c.get('scene') or 'not placed yet'})"
        for c in clues or []
    )

    return f"""{TWIST_IMPACT_SYSTEM}

Story: "{story_title}"
Twist: "{twist_name}"
Truth: {the_truth or "(not set)"}
Misdirection: {the_misdirection or "(not set)"}
Revealed in: {reveal or "(no reveal scene yet)"}

Clues planted:
{clues_text or "(none)"}

Plot threads:
{threads_text or "(none)"}

Characters:
{chars_text or "(none)"}

Scenes, in reading order:
{scenes_text or "(none)"}

Analyze the downstream impact when this twist is revealed. Return JSON:
{{
  "affected_threads": [{{"thread_id": "...", "thread_name": "...", "impact": "..."}}],
  "affected_arcs": [{{"character_id": "...", "character_name": "...", "arc_change": "..."}}],
  "scenes_to_review": [{{"node_id": "...", "scene_title": "...", "reason": "..."}}],
  "loose_ends": ["..."],
  "ripple_effects": [{{"area": "...", "description": "..."}}],
  "overall_assessment": "2-3 sentence summary"
}}"""
