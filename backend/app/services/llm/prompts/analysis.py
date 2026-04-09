"""
Analysis prompts — character arc analysis, MICE economy, session recap.
"""

from ....models.character import Character
from ....models.plot_thread import PlotThread
from ....models.story import Story


def build_character_arc_prompt(
    character: Character,
    story_title: str,
    profile_parts: list[str],
    milestones_text: str,
    scenes_text: str,
) -> str:
    """Prompt to analyze where a character is in their arc based on written content."""
    return (
        f"You are analyzing the character arc of {character.name} in '{story_title}'.\n\n"
        f"Character profile:\n{chr(10).join(profile_parts) if profile_parts else 'No profile yet.'}"
        f"{milestones_text}\n\n"
        f"Scenes where {character.name} appears:\n{scenes_text}\n\n"
        f"Answer: Where is {character.name} right now in their arc? What have they done, how have they changed, "
        f"and what still needs to happen? Be specific about what's been written vs. what's planned."
    )


def build_thread_analysis_prompt(
    thread: PlotThread,
    story_title: str,
    story_context: str,
    scenes: list[dict],  # [{"id", "title", "content_excerpt"}]
) -> str:
    """Structured JSON prompt to analyze a plot thread's progression and quality."""
    cycles_text = ""
    if thread.try_fail_cycles:
        lines = []
        for i, c in enumerate(thread.try_fail_cycles, 1):
            scene_ref = f"[{c.get('scene_title', 'unlinked')}]" if c.get("scene_title") or c.get("scene_id") else "[unlinked]"
            lines.append(f"  {i}. {c.get('action', '?')} → {c.get('outcome_type', '?')} {scene_ref}")
        cycles_text = "\n".join(lines)
    else:
        cycles_text = "  (none defined)"

    scenes_block = ""
    if scenes:
        parts = []
        for s in scenes:
            excerpt = s.get("content_excerpt", "")[:500]
            parts.append(f"[{s['title']}]\n{excerpt}{'...' if len(s.get('content_excerpt','')) > 500 else ''}")
        scenes_block = "\n\n".join(parts)
    else:
        scenes_block = "(no scenes tagged to this thread yet)"

    return f"""You are a story craft advisor analyzing a plot thread in "{story_title}".

THREAD: {thread.name}
Type (MICE): {thread.mice_type or "unspecified"}
Status: {thread.status}
Description: {thread.description or "(none)"}

Story context: {story_context or "Not provided"}

TRY/FAIL CYCLES ({len(thread.try_fail_cycles or [])} defined):
{cycles_text}

SCENES WHERE THIS THREAD APPEARS ({len(scenes)} scenes):
{scenes_block}

Analyze this plot thread and respond with a JSON object matching this exact schema:

{{
  "progression": {{
    "summary": "1-2 sentence overview of where this thread is in its MICE lifecycle",
    "details": ["specific observation about the thread's current state", "what has been established", "what still needs to happen"]
  }},
  "moment_discoveries": [
    {{
      "scene_id": "the scene id from the data above",
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


def build_arc_analysis_prompt(
    character: Character,
    story_title: str,
    story_context: str,
    scenes: list[dict],   # [{"id", "title", "content_excerpt"}]
) -> str:
    """Structured JSON prompt to analyze a character arc's trajectory and health."""
    milestones_block = ""
    if character.arc_milestones:
        lines = []
        for m in character.arc_milestones:
            status = "✓" if m.get("completed") else "○"
            scene_link = f" [linked to: {m.get('scene_title', m.get('scene_id', ''))}]" if m.get("scene_id") else ""
            lines.append(f"  {status} {m['text']}{scene_link}")
        milestones_block = "\n".join(lines)
    else:
        milestones_block = "  (none defined)"

    profile_parts = []
    if character.narrative_intent:
        profile_parts.append(f"Planned arc: {character.narrative_intent}")
    if character.arc_notes:
        profile_parts.append(f"Arc notes: {character.arc_notes}")
    if character.personality:
        profile_parts.append(f"Personality: {character.personality}")
    if character.motivation:
        profile_parts.append(f"Motivation: {character.motivation}")
    profile_block = "\n".join(profile_parts) if profile_parts else "(no profile defined)"

    scenes_block = ""
    if scenes:
        parts = []
        for s in scenes:
            excerpt = s.get("content_excerpt", "")[:500]
            parts.append(f"[{s['title']}]\n{excerpt}{'...' if len(s.get('content_excerpt','')) > 500 else ''}")
        scenes_block = "\n\n".join(parts)
    else:
        scenes_block = "(no scenes featuring this character yet)"

    return f"""You are a story craft advisor analyzing the character arc of {character.name} in "{story_title}".

CHARACTER: {character.name} ({character.role})
{profile_block}

PLANNED MILESTONES:
{milestones_block}

Story context: {story_context or "Not provided"}

SCENES FEATURING {character.name.upper()} ({len(scenes)} scenes):
{scenes_block}

Analyze this character arc and respond with a JSON object matching this exact schema:

{{
  "trajectory": {{
    "summary": "1-2 sentence overview of where {character.name} is in their arc right now",
    "details": ["what has changed so far", "current emotional/narrative state", "what arc still needs to happen"]
  }},
  "moment_discoveries": [
    {{
      "scene_id": "the scene id from the data above",
      "scene_title": "scene title",
      "arc_significance": "brief description of what shifts for {character.name} here",
      "suggested_milestone_link": "text of the milestone this might fulfill, or empty string"
    }}
  ],
  "drift_analysis": {{
    "summary": "How closely the written scenes align with the planned arc",
    "details": ["specific way the arc is on track", "specific divergence from planned arc if any", "whether drift strengthens or weakens the story"]
  }},
  "health": {{
    "summary": "Overall arc health: pacing, setup, payoff",
    "details": ["observation about arc pacing (too rushed/slow?)", "missing beats or gaps", "any contradictions between planned and written arc"]
  }},
  "unlinked_milestones": [
    "text of any milestone that has no clear scene fulfilling it yet"
  ],
  "suggestions": [
    "specific, actionable suggestion referencing scene and character names"
  ],
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- moment_discoveries: only scenes where something meaningfully shifts for {character.name}.
- suggested_milestone_link: exact text of a milestone from the list above, or empty string.
- overall_rating: needs_work = major arc issues, fair = functional but underdeveloped, good = solid craft, excellent = exemplary."""


def build_economy_analysis_prompt(
    story_title: str,
    story_intent: str | None,
    length_context: str,
    threads_summary: list[str],
    scenes_info: list[str],
) -> str:
    """Prompt to analyze story economy against MICE principles for short fiction."""
    return f"""You are a short fiction editor analyzing story economy for "{story_title}".

{length_context}Story intent: {story_intent or "Not specified"}

MICE THREADS ({len(threads_summary)} total):
{chr(10).join(threads_summary) if threads_summary else "No threads defined yet."}

SCENES ({len(scenes_info)} total):
{chr(10).join(scenes_info) if scenes_info else "No scenes yet."}

Analyze this story's economy from a short fiction perspective and respond with a JSON object matching this exact schema:

{{
  "thread_balance": {{
    "summary": "1-2 sentence overview of thread count and form-appropriateness",
    "details": ["specific observation 1", "specific observation 2", "..."]
  }},
  "scene_economy": {{
    "summary": "1-2 sentence overview of scene utility and word distribution",
    "details": ["specific observation about scene or word count", "..."]
  }},
  "try_fail_cycles": {{
    "summary": "1-2 sentence overview of struggle depth across threads",
    "details": ["observation about a specific thread's cycle count", "..."]
  }},
  "recommendations": [
    "Specific actionable suggestion referencing scene and thread names",
    "...",
    "3-5 total recommendations"
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text before or after.
- Reference specific scene and thread names from the data above.
- details arrays: 1-4 items each, concrete and specific.
- recommendations: 3-5 items, each actionable."""


def build_session_recap_prompt(
    story_title: str,
    story_overview: str,
    scenes_text: str,
    activity_text: str,
    interviews_text: str,
) -> str:
    """Prompt to generate a warm, informative recap of the writer's recent work."""
    return f"""You are a writing companion for the story "{story_title}".

Story overview: {story_overview}

Here is what the writer has been working on recently:

RECENTLY EDITED SCENES:
{scenes_text or "None."}

RECENT ACTIVITY:
{activity_text or "None."}

RECENT CHARACTER INTERVIEWS:
{interviews_text or "None."}

Write a brief, warm, encouraging recap of what the writer worked on. Speak directly to them ("You've been..."). Keep it to 3–5 sentences. Focus on what was accomplished and what threads are still in motion. Don't list everything mechanically — weave it into a natural paragraph that makes them feel the momentum of their work. Don't offer suggestions or critique."""
