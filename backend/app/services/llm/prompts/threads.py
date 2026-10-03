"""
Plot thread analysis prompt (doc 18: moved out of analysis.py, which is over its size budget).
"""

from ....models.plot_thread import PlotThread

OUTCOME_LABELS = {
    "fail_disaster": "Fail: disaster",
    "fail_setback": "Fail: setback",
    "success_cost": "Success, at a cost",
    "success_clean": "Success, clean",
}


def build_thread_analysis_prompt(
    thread: PlotThread,
    story_title: str,
    story_context: str,
    # In reading order: [{"id", "title", "content_excerpt", "synopsis", "note", "role"}]
    scenes: list[dict],
    titles: dict[str, str] | None = None,
) -> str:
    """Structured JSON prompt to analyze a plot thread's progression and quality.

    Doc 18: the cycles arrive as stored (description, outcome, node_id; it read action and
    outcome_type and sent every cycle as "? → ?"), scenes carry their ids and come in reading
    order, and where the thread opens and closes is said.
    """
    titles = titles or {}

    def scene_name(node_id: str | None) -> str:
        return f"[{node_id}] {titles.get(node_id, 'a scene')}" if node_id else "unlinked"

    cycles_text = ""
    if thread.try_fail_cycles:
        lines = []
        for i, c in enumerate(thread.try_fail_cycles, 1):
            outcome = OUTCOME_LABELS.get(c.get("outcome") or "", c.get("outcome") or "outcome not set")
            lines.append(
                f"  {i}. {c.get('description') or '(no description)'} → {outcome} ({scene_name(c.get('node_id'))})"
            )
        cycles_text = "\n".join(lines)
    else:
        cycles_text = "  (none defined)"

    shape = (
        f"Opens in: {scene_name(thread.opens_at_node_id)}\n"
        f"Closes in: {scene_name(thread.closes_at_node_id) if thread.closes_at_node_id else 'not closed yet'}"
    )

    scenes_block = ""
    if scenes:
        parts = []
        for s in scenes:
            head = f"[{s['id']}] {s['title']}"
            if s.get("role"):
                head += f" ({s['role']})"
            body = []
            if s.get("note"):
                body.append(f"What the author says happens to the thread here: {s['note']}")
            excerpt = s.get("content_excerpt", "")
            if excerpt:
                body.append(excerpt[:500] + ("..." if len(excerpt) > 500 else ""))
            elif s.get("synopsis"):
                body.append(f"(not written yet) Planned: {s['synopsis']}")
            else:
                body.append("(not written yet)")
            parts.append(head + "\n" + "\n".join(body))
        scenes_block = "\n\n".join(parts)
    else:
        scenes_block = "(no scenes tagged to this thread yet)"

    return f"""You are a story craft advisor analyzing a plot thread in "{story_title}".

THREAD: {thread.name}
Type (MICE): {thread.mice_type or "unspecified"}
Status: {thread.status}
Description: {thread.description or "(none)"}
{shape}

Story context: {story_context or "Not provided"}

TRY/FAIL CYCLES ({len(thread.try_fail_cycles or [])} defined):
{cycles_text}

SCENES WHERE THIS THREAD APPEARS, in reading order ({len(scenes)} scenes):
{scenes_block}

Analyze this plot thread and respond with a JSON object matching this exact schema:

{{
  "progression": {{
    "summary": "1-2 sentence overview of where this thread is in its MICE lifecycle",
    "details": ["specific observation about the thread's current state", "what has been established", "what still needs to happen"]
  }},
  "moment_discoveries": [
    {{
      "scene_id": "the scene id in square brackets above",
      "scene_title": "scene title",
      "moment_type": "inciting | complication | turning_point | climax | resolution",
      "description": "brief description of what this scene does for the thread",
      "suggested_cycle_link": true or false
    }}
  ],
  "quality": {{
    "summary": "1-2 sentence assessment of pacing, struggle depth, and resolution setup",
    "details": ["specific observation about try/fail cycle depth", "observation about pacing or tension", "observation about setup/payoff"]
  }},
  "unlinked_cycles": [
    "description of any try/fail cycle that has no scene assigned"
  ],
  "suggestions": [
    "specific, actionable suggestion referencing scene and thread names"
  ],
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- moment_discoveries: only include scenes that mark a meaningful beat — not every scene.
- suggested_cycle_link is true if the scene represents a distinct attempt/failure worth tracking.
- overall_rating: needs_work = major structural issues, fair = functional but weak, good = solid craft, excellent = exemplary."""
