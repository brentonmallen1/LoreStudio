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
) -> str:
    threads_text = "\n".join(f"- [{t['id']}] {t['name']}: {t.get('description', '')}" for t in threads)
    chars_text = "\n".join(f"- [{c['id']}] {c['name']}: {c.get('role', '')}" for c in characters)
    scenes_text = "\n".join(f"- [{s['id']}] {s['title']}: {s.get('synopsis', '')}" for s in scenes)

    return f"""Story: "{story_title}"
Twist: "{twist_name}"
Truth: {the_truth or "(not set)"}
Misdirection: {the_misdirection or "(not set)"}

Plot threads:
{threads_text or "(none)"}

Characters:
{chars_text or "(none)"}

Scenes:
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
