"""
Analysis prompts — character arc analysis, MICE economy, session recap, show-don't-tell, audience adherence.
"""

from ....models.character import Character
from ....models.plot_thread import PlotThread
from ....models.story import Story


TARGET_AUDIENCES: dict[str, dict[str, str]] = {
    "kids": {
        "label": "Kids (6-8)",
        "vocabulary": "Simple, common words only. Avoid polysyllabic or literary vocabulary.",
        "sentence_structure": "Short, simple sentences. No complex subordinate clauses.",
        "themes": "Friendship, family, curiosity, simple moral lessons, light adventure.",
        "content": "No violence, death, fear, or adult themes of any kind.",
        "pacing": "Fast, action-oriented, plenty of dialogue, short paragraphs.",
    },
    "middle_grade": {
        "label": "Middle Grade (8-12)",
        "vocabulary": "Accessible vocabulary; new words are fine if introduced in clear context.",
        "sentence_structure": "Varied length but generally clear. Some complexity is fine.",
        "themes": "Identity, belonging, friendship, first real challenges, humor, adventure.",
        "content": "Mild peril and suspense okay. No graphic violence, explicit content, or heavy romance (crushes are fine).",
        "pacing": "Balanced action and reflection. Chapters can be longer.",
    },
    "young_adult": {
        "label": "Young Adult (12-18)",
        "vocabulary": "No vocabulary restrictions. Literary language welcome.",
        "sentence_structure": "Any complexity is appropriate.",
        "themes": "Identity, first love, moral ambiguity, social issues, trauma and recovery.",
        "content": "Violence, death, and romance are fine. Explicit sexual content typically avoided in mainstream YA.",
        "pacing": "Flexible by genre.",
    },
    "new_adult": {
        "label": "New Adult (18-25)",
        "vocabulary": "No restrictions.",
        "sentence_structure": "No restrictions.",
        "themes": "College life, early career, serious relationships, independence, self-discovery.",
        "content": "Adult content including explicit romance is common in the genre.",
        "pacing": "Genre-dependent.",
    },
    "adult": {
        "label": "Adult",
        "vocabulary": "No restrictions.",
        "sentence_structure": "No restrictions.",
        "themes": "Full thematic range with no restrictions.",
        "content": "No content restrictions.",
        "pacing": "Genre-dependent.",
    },
}


def build_show_dont_tell_prompt(
    prose_text: str,
    story_title: str,
    genre: str | None = None,
    tone: str | None = None,
) -> str:
    """Structured JSON prompt to identify 'telling' passages and suggest 'showing' alternatives."""
    context_parts = []
    if genre:
        context_parts.append(f"Genre: {genre}")
    if tone:
        context_parts.append(f"Tone: {tone}")
    context_block = "\n".join(context_parts) if context_parts else ""

    return f"""You are a fiction editor analyzing prose from "{story_title}" for "show don't tell" opportunities.

{context_block}

DEFINITIONS:
- TELLING: Directly stating an emotion, internal state, or quality. ("She was angry." / "The room was dirty." / "He felt nervous.")
- SHOWING: Demonstrating through observable action, dialogue, sensory detail, or physical manifestation. ("Her jaw clenched. She set down the cup with a click." / "Pizza boxes teetered in the corner, ringed with grease stains." / "He kept checking the door.")

SEVERITY LEVELS:
- strong: Clear, unambiguous statement of emotion/state/quality that would benefit significantly from showing
- moderate: Telling that softens or flattens what could be more vivid
- subtle: Borderline case — may be intentional for pacing; note but don't overweight

ISSUE TYPES:
- emotion: Direct labeling of an emotional state ("she was happy", "he felt sad")
- state: Direct labeling of a condition or status ("the house was a mess", "he was tired")
- quality: Direct assertion of a trait or judgment ("she was beautiful", "the food was delicious")
- exposition: Narratorial information delivered flatly rather than shown through scene

NOTE: Telling is not always wrong — it is valid for transitions, pacing, summary, and deliberate stylistic effect. Only flag passages where showing would meaningfully strengthen the prose.

PROSE TO ANALYZE:
{prose_text}

Respond with a JSON object matching this exact schema:

{{
  "instances": [
    {{
      "passage": "the exact text from the prose that is telling (quote it precisely)",
      "severity": "strong | moderate | subtle",
      "issue_type": "emotion | state | quality | exposition",
      "explanation": "1 sentence explaining why this is telling and what it flattens",
      "suggestion": "a concrete showing alternative (1-3 sentences) that maintains the author's intent"
    }}
  ],
  "summary": "2-3 sentence overall assessment of the prose's showing vs telling balance",
  "overall_rating": "needs_work | fair | good | excellent",
  "strengths": [
    "specific thing the prose does well in terms of showing"
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- instances: only flag passages worth revising — skip intentional stylistic telling
- passage: must be a verbatim excerpt from the text above (keep it short — 10 words max)
- suggestion: write it in the style and voice of the original prose
- strengths: 1-3 items, specific to this text
- overall_rating: needs_work = many strong instances, fair = several moderate, good = mostly showing with minor lapses, excellent = exemplary showing throughout"""


def build_audience_adherence_prompt(
    prose_text: str,
    story_title: str,
    target_audience: str,
) -> str:
    """Structured JSON prompt to analyze how well prose matches its target audience."""
    audience_data = TARGET_AUDIENCES.get(target_audience, {})
    audience_label = audience_data.get("label", target_audience)

    expectations = "\n".join([
        f"- Vocabulary: {audience_data.get('vocabulary', 'N/A')}",
        f"- Sentence structure: {audience_data.get('sentence_structure', 'N/A')}",
        f"- Themes: {audience_data.get('themes', 'N/A')}",
        f"- Content: {audience_data.get('content', 'N/A')}",
        f"- Pacing: {audience_data.get('pacing', 'N/A')}",
    ]) if audience_data else f"Target audience: {target_audience}"

    return f"""You are a developmental editor analyzing prose from "{story_title}" for target audience fit.

TARGET AUDIENCE: {audience_label}
EXPECTATIONS FOR THIS AUDIENCE:
{expectations}

PROSE TO ANALYZE:
{prose_text}

Identify passages that may not fit this audience and provide an overall assessment.

ISSUE TYPES:
- vocabulary: Words too complex, archaic, or inappropriate for this age group
- content: Violence, sexuality, themes, or situations beyond what this audience expects
- theme: Thematic concerns (moral complexity, adult situations) misaligned with audience
- pacing: Sentence or paragraph length that doesn't match the audience's typical tolerance
- tone: Register (ironic, dark, clinical) that doesn't serve this audience

SEVERITY:
- critical: Likely to alienate readers or concern parents/gatekeepers
- moderate: Worth adjusting for better audience fit
- minor: Fine-tuning suggestion; probably not essential

Respond with a JSON object matching this exact schema:

{{
  "target_audience": "{audience_label}",
  "issues": [
    {{
      "passage": "verbatim excerpt from the prose (10 words max)",
      "issue_type": "vocabulary | content | theme | pacing | tone",
      "severity": "critical | moderate | minor",
      "explanation": "1 sentence explaining the mismatch",
      "suggestion": "concrete alternative or adjustment"
    }}
  ],
  "vocabulary_assessment": "1-2 sentence assessment of vocabulary fit for this audience",
  "content_assessment": "1-2 sentence assessment of content appropriateness",
  "theme_assessment": "1-2 sentence assessment of thematic alignment",
  "overall_fit": "poor | fair | good | excellent",
  "summary": "2-3 sentence overall assessment of how well this prose serves its target audience"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Only flag genuine mismatches — do not flag things that are perfectly fine for this audience
- passage: verbatim excerpt (10 words max)
- overall_fit: poor = multiple critical issues, fair = several moderate issues, good = minor issues only, excellent = well-calibrated throughout"""


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


def build_essential_questions_prompt(
    character: Character,
    story: Story,
    scenes_content: str,
) -> str:
    """Structured JSON prompt to assess whether the 6 Essential Questions are answerable."""
    profile_parts = []
    if character.motivation:
        profile_parts.append(f"Motivation: {character.motivation}")
    if character.mission_statement:
        profile_parts.append(f"Mission: {character.mission_statement}")
    if character.narrative_intent:
        profile_parts.append(f"Author's intent for this character: {character.narrative_intent}")
    if character.arc_notes:
        profile_parts.append(f"Arc notes: {character.arc_notes}")
    if character.background:
        profile_parts.append(f"Background: {character.background}")
    if character.arc_milestones:
        milestones = [f"  {'✓' if m.get('completed') else '○'} {m['text']}" for m in character.arc_milestones]
        profile_parts.append("Arc milestones:\n" + "\n".join(milestones))
    profile_block = "\n".join(profile_parts) if profile_parts else "(no profile defined)"

    story_parts = []
    if story.narrative_intent:
        story_parts.append(f"Narrative intent: {story.narrative_intent}")
    if story.central_conflict:
        story_parts.append(f"Central conflict: {story.central_conflict}")
    if story.premise:
        story_parts.append(f"Premise: {story.premise}")
    if story.goals:
        goal_lines = [f"  {'✓' if g.get('completed') else '○'} {g['text']}" for g in story.goals]
        story_parts.append("Story goals:\n" + "\n".join(goal_lines))
    story_block = "\n".join(story_parts) if story_parts else "(no story context defined)"

    return f"""You are a story craft advisor evaluating narrative clarity for the story "{story.title}".

You are assessing whether the six essential story questions can be answered for the character {character.name}.

CHARACTER: {character.name} (role: {character.role})
{profile_block}

STORY CONTEXT:
{story_block}

SCENES FEATURING {character.name.upper()}:
{scenes_content or "(no scenes written yet)"}

For each of the six essential questions, assess whether it is clearly answered (clear), partially answered (partial), or not yet answered (unclear) based on the information above.

Respond with a JSON object matching this exact schema:

{{
  "protagonist": {{
    "question": "Who is the protagonist?",
    "status": "clear | partial | unclear",
    "evidence": "what in the story data establishes this clearly (or what is missing)",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "want": {{
    "question": "What do they want?",
    "status": "clear | partial | unclear",
    "evidence": "what establishes the external desire line",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "why": {{
    "question": "Why do they want it?",
    "status": "clear | partial | unclear",
    "evidence": "what establishes the internal motivation or emotional stakes",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "obstacle": {{
    "question": "What's stopping them?",
    "status": "clear | partial | unclear",
    "evidence": "what establishes the conflict, opposition, or obstacle force",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "stakes": {{
    "question": "What's at stake if they fail?",
    "status": "clear | partial | unclear",
    "evidence": "what establishes the consequences of failure",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "change": {{
    "question": "How do they change?",
    "status": "clear | partial | unclear",
    "evidence": "what establishes the arc, transformation, or intended change",
    "recommendation": "what to add or clarify if status is not clear"
  }},
  "overall_clarity": "needs_work | fair | good | excellent",
  "summary": "2-3 sentence overall assessment of narrative clarity for this character"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Base assessment on what is actually written or defined — not what you imagine could be there.
- If the story has no written scenes yet, assess based solely on the character profile and story context.
- overall_clarity: needs_work = 3+ unclear, fair = 1-2 unclear, good = all partial or better, excellent = all clear."""


def build_pacing_analysis_prompt(
    story_title: str,
    story_intent: str | None,
    intended_length: str | None,
    scenes_info: list[str],  # ["[Scene Title] (N words, status) — Act X"]
    total_words: int,
) -> str:
    """Prompt to analyze pacing, act balance, and tension curve."""
    length_note = f"Intended form: {intended_length.replace('_', ' ') if intended_length else 'unspecified'}"
    return f"""You are a developmental editor analyzing the pacing and structure of "{story_title}".

{length_note}
Total words written: {total_words:,}
Story intent: {story_intent or "Not specified"}

SCENES IN ORDER ({len(scenes_info)} total):
{chr(10).join(scenes_info) if scenes_info else "No scenes yet."}

Analyze the pacing and structural balance of this story. Respond with a JSON object matching this exact schema:

{{
  "act_balance": {{
    "summary": "1-2 sentence overview of how word count is distributed across the story's sections",
    "details": ["specific observation about a section or act", "another observation"]
  }},
  "tension_curve": {{
    "summary": "1-2 sentence overview of the tension arc: is it rising, episodic, front-loaded?",
    "details": ["where tension peaks based on scene titles and positions", "where it drops"]
  }},
  "slow_spots": [
    "Scene title or section name that appears underweight or low-energy given its position"
  ],
  "pacing_strengths": [
    "Something working well about the pacing or structure"
  ],
  "recommendations": [
    "Specific, actionable suggestion referencing scene names or positions",
    "3-5 total recommendations"
  ],
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Base all observations on scene titles, positions, and word counts — not invented content.
- slow_spots: 0-5 items. Only flag scenes that are clearly underweight for their story position.
- overall_rating: needs_work = significant imbalance, fair = some concerns, good = mostly solid, excellent = well-paced."""


def build_continuity_check_prompt(
    story_title: str,
    story_intent: str | None,
    characters_summary: list[str],
    scenes_with_content: list[str],  # ["[Scene] content excerpt..."]
) -> str:
    """Prompt to check for continuity issues across scenes."""
    return f"""You are a continuity editor for the story "{story_title}".

Story intent: {story_intent or "Not specified"}

CHARACTERS:
{chr(10).join(characters_summary) if characters_summary else "No characters defined."}

SCENES (in order, with excerpts):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

Read the scenes carefully and flag any continuity problems — inconsistencies in facts, character knowledge, timeline, or physical details. Respond with this exact JSON schema:

{{
  "issues": [
    {{
      "description": "short label for the inconsistency",
      "severity": "critical | moderate | minor",
      "scene_references": ["Scene Title A", "Scene Title B"],
      "explanation": "what is inconsistent and why it matters",
      "suggestion": "what the author might consider to resolve it"
    }}
  ],
  "timeline_notes": [
    "General observation about timeline order or temporal logic"
  ],
  "character_notes": [
    "General observation about character knowledge or state that seems off"
  ],
  "summary": "2-3 sentence overall assessment of continuity health",
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Only flag genuine inconsistencies — not stylistic choices or deliberate ambiguity.
- If there are no continuity issues, return an empty issues array with a positive summary.
- severity: critical = breaks the story, moderate = noticeable by readers, minor = small detail slip.
- overall_rating: needs_work = multiple critical issues, fair = moderate issues, good = minor only, excellent = clean."""


def build_theme_tracker_prompt(
    story_title: str,
    story_intent: str | None,
    story_themes: list[str],
    scenes_with_content: list[str],
) -> str:
    """Prompt to identify recurring themes, motifs, and their development."""
    declared_themes = ", ".join(story_themes) if story_themes else "none declared"
    return f"""You are a literary analyst identifying themes and motifs in "{story_title}".

Story intent: {story_intent or "Not specified"}
Declared themes: {declared_themes}

SCENES (in order):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

Identify the themes, motifs, and thematic arc of this story. Respond with this exact JSON schema:

{{
  "themes": [
    {{
      "name": "theme name (e.g., 'Isolation and connection')",
      "description": "1 sentence describing what this theme explores in this story",
      "scenes": ["Scene Title where this theme is present"],
      "development": "how this theme develops or changes across the story so far",
      "strength": "emerging | present | well_developed"
    }}
  ],
  "motifs": [
    "A recurring image, symbol, object, or phrase and its apparent significance"
  ],
  "thematic_arc": "2-3 sentence overview of the overall thematic journey the story seems to be making",
  "gaps": [
    "A thematic thread raised but not yet developed or paid off"
  ],
  "recommendations": [
    "Specific suggestion for deepening or connecting themes — referencing scene names"
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- themes: 1-6 items. Only name themes actually supported by the text.
- motifs: 0-5 items. Concrete recurring elements, not abstract ideas.
- gaps: thematic opportunities suggested by the story's setup but not yet explored.
- recommendations: 1-4 items, actionable and scene-specific."""


def build_plot_hole_detection_prompt(
    story_title: str,
    story_intent: str | None,
    characters_summary: list[str],
    threads_summary: list[str],
    scenes_with_content: list[str],
) -> str:
    """Prompt to detect logical gaps and plot holes."""
    return f"""You are a story logic analyst for "{story_title}".

Story intent: {story_intent or "Not specified"}

CHARACTERS:
{chr(10).join(characters_summary) if characters_summary else "No characters defined."}

PLOT THREADS:
{chr(10).join(threads_summary) if threads_summary else "No threads defined."}

SCENES (in order, with excerpts):
{chr(10).join(scenes_with_content) if scenes_with_content else "No scenes written yet."}

Analyze this story for logical gaps, plot holes, and unanswered questions. A plot hole is a gap in logic that cannot be explained by what is written. Respond with this exact JSON schema:

{{
  "holes": [
    {{
      "description": "short label for the plot hole",
      "severity": "critical | moderate | minor",
      "scene_references": ["Scene Title involved"],
      "explanation": "why this is a logical problem in the story as written",
      "suggestion": "what the author might consider to address it"
    }}
  ],
  "logic_gaps": [
    "A smaller logical question or inconsistency that is not quite a full plot hole"
  ],
  "unanswered_questions": [
    "A question raised by the story that has not yet been addressed — may be intentional"
  ],
  "summary": "2-3 sentence overall assessment of story logic health",
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Only flag genuine logical problems — not red herrings, mysteries, or deliberate ambiguity.
- If the story is at an early stage with little written, note that in the summary and minimize issues.
- severity: critical = breaks the story, moderate = noticeable plot problem, minor = small logical slip.
- overall_rating: needs_work = multiple critical holes, fair = moderate issues, good = minor only, excellent = logically sound."""


def build_dialogue_attribution_prompt(
    scene_text: str,
    character_list: str,
    already_attributed: str,
    pov_character: str = "",
    narrative_perspective: str = "",
) -> str:
    """
    Prompt the LLM to infer speakers for unattributed dialogue quotes in a scene.

    Returns a JSON array via the structured output path.
    """
    pov_hint = ""
    if pov_character and narrative_perspective in ("first_person", "multiple_pov"):
        pov_hint = f"\nNARRATIVE PERSPECTIVE: First-person. The POV character (narrator) is {pov_character}. Unattributed dialogue is most likely spoken by {pov_character} unless the prose clearly indicates another speaker.\n"

    return f"""You are helping a fiction writer identify who is speaking each line of unattributed dialogue in their scene.

CHARACTERS IN THIS SCENE:
{character_list or "No characters listed."}
{pov_hint}
ALREADY ATTRIBUTED DIALOGUE (use these as context for speaker voices and conversation flow):
{already_attributed or "None yet."}

SCENE TEXT:
{scene_text}

Your task: For each unattributed dialogue quote (lines in double quotes that do NOT already have a <Name> tag), identify the most likely speaker.

Use these signals to infer the speaker:
- Explicit prose cues ("she said", "he asked", "Maya replied")
- Conversation flow — dialogue often alternates between speakers
- Character voice — word choice, tone, vocabulary consistent with a character's profile
- Narrative context — who is present, what just happened, who would logically speak here

Return ONLY a JSON object in this exact format:
{{
  "suggestions": [
    {{
      "quote_text": "the exact dialogue text without quotes",
      "suggested_speaker": "Character Name",
      "confidence": 0.9,
      "reasoning": "Brief explanation of why this character is speaking"
    }}
  ]
}}

Rules:
- Only include quotes that are truly unattributed (no <Name> tag)
- If you cannot determine the speaker with reasonable confidence, still include it with confidence below 0.4 and explain the ambiguity
- Use exact character names from the list above
- confidence is a float 0.0–1.0"""



def build_first_pass_prompt(
    story_title: str,
    story_intent: str | None,
    story_goals: list[str],
    genre: str | None,
    tone: str | None,
    characters_summary: list[str],   # ["Name (role): arc description, pending milestones"]
    scenes_info: list[str],          # ["[Scene Title] (N words, status): synopsis"]
    total_words: int,
) -> str:
    """Prompt for the first-pass editor: compare prose against stated intent."""
    goals_block = "\n".join(f"- {g}" for g in story_goals) if story_goals else "No goals set."
    return f"""You are a developmental editor performing a first-pass review of "{story_title}".

Your job is NOT to give generic writing advice. Compare the story AS WRITTEN against the author's stated intentions and flag gaps between plan and execution.

STORY INTENT: {story_intent or "Not specified"}
GENRE: {genre or "Not specified"}
TONE: {tone or "Not specified"}
TOTAL WORDS: {total_words:,}

STATED GOALS:
{goals_block}

CHARACTERS AND ARCS:
{chr(10).join(characters_summary) if characters_summary else "No characters defined."}

SCENES IN ORDER:
{chr(10).join(scenes_info) if scenes_info else "No scenes written yet."}

Review the above and assess how well the written story delivers on its stated intent. Respond with this exact JSON schema:

{{
  "goal_alignment": {{
    "summary": "1-2 sentence assessment of whether stated story goals are being met",
    "details": ["specific observation about a goal — met, partially met, or missed"]
  }},
  "arc_progress": {{
    "summary": "1-2 sentence assessment of whether character arcs are tracking toward planned milestones",
    "details": ["character-specific arc observation referencing their stated trajectory and what scenes show"]
  }},
  "tone_consistency": {{
    "summary": "1-2 sentence assessment of whether scenes feel consistent with the stated tone/genre",
    "details": ["specific scene or section that drifts from intended tone, if any"]
  }},
  "missed_setups": [
    "A setup, foreshadowing element, or planted detail that should exist given stated goals but isn't visible yet"
  ],
  "gaps": [
    {{
      "area": "goal_alignment | arc_progress | tone | setup | pacing",
      "finding": "what the gap is",
      "severity": "critical | moderate | minor",
      "scene_references": ["Scene Title(s) involved"],
      "suggestion": "what to consider adding, adjusting, or planting"
    }}
  ],
  "strengths": [
    "Something working well relative to the stated intent — be specific"
  ],
  "recommendations": [
    "Specific, actionable recommendation tied to intent or goals — not generic advice"
  ],
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Every observation must be grounded in the stated intent, goals, or arc milestones — not generic writing advice.
- If no story intent or goals are set, note this and focus on what can be inferred from the character arcs and scene progression.
- missed_setups: only include if a gap is clearly implied by the stated goals or arc milestones.
- gaps: 0-6 items ranked by severity. Only flag genuine mismatches between intent and prose.
- overall_rating: needs_work = intent not visible in prose, fair = partial alignment, good = mostly aligned, excellent = intent clearly realized."""
