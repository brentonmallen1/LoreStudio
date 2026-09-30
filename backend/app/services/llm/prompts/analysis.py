"""
Analysis prompts — character arc analysis, MICE economy, session recap, show-don't-tell, audience adherence.
"""

from ....models.character import Character
from ....models.plot_thread import PlotThread
from ....models.story import Story
from .interviews import _ATTR_GUIDANCE, _ATTR_LABELS, _normalise

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
      "question": "one short question that would lead the author to show it instead (e.g. 'what do her hands do while she says this?')"
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
- question: a question only. Never a replacement sentence, never "try something like…", never
  a rewritten version of the passage. The author writes the prose; you point at the gap
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

    expectations = (
        "\n".join(
            [
                f"- Vocabulary: {audience_data.get('vocabulary', 'N/A')}",
                f"- Sentence structure: {audience_data.get('sentence_structure', 'N/A')}",
                f"- Themes: {audience_data.get('themes', 'N/A')}",
                f"- Content: {audience_data.get('content', 'N/A')}",
                f"- Pacing: {audience_data.get('pacing', 'N/A')}",
            ]
        )
        if audience_data
        else f"Target audience: {target_audience}"
    )

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
            scene_ref = (
                f"[{c.get('scene_title', 'unlinked')}]" if c.get("scene_title") or c.get("scene_id") else "[unlinked]"
            )
            lines.append(f"  {i}. {c.get('action', '?')} → {c.get('outcome_type', '?')} {scene_ref}")
        cycles_text = "\n".join(lines)
    else:
        cycles_text = "  (none defined)"

    scenes_block = ""
    if scenes:
        parts = []
        for s in scenes:
            excerpt = s.get("content_excerpt", "")[:500]
            parts.append(f"[{s['title']}]\n{excerpt}{'...' if len(s.get('content_excerpt', '')) > 500 else ''}")
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
    scenes: list[dict],  # [{"id", "title", "content_excerpt"}]
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
            parts.append(f"[{s['title']}]\n{excerpt}{'...' if len(s.get('content_excerpt', '')) > 500 else ''}")
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
    characters_summary: list[str],  # ["Name (role): arc description, pending milestones"]
    scenes_info: list[str],  # ["[Scene Title] (N words, status): synopsis"]
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


def build_cliche_analysis_prompt(
    story_title: str,
    genre: str | None,
    tone: str | None,
    scenes: list[dict],
    total_words: int,
) -> str:
    """Structured JSON prompt to identify clichés and overused patterns across all scenes."""

    genre_line = f"Genre: {genre}." if genre else ""
    tone_line = f"Tone: {tone}." if tone else ""
    scenes_block = "\n\n".join(f"[SCENE: {s['title']} | id: {s['id']}]\n{s['content'][:2000]}" for s in scenes)

    return f"""You are a developmental editor analyzing prose from "{story_title}" for clichéd language and patterns.

{genre_line} {tone_line}
Approximate word count: {total_words:,}

CLICHE TYPES:
- phrase: Overused expressions ("dark as night", "heart of gold", "deafening silence", "a storm was coming")
- trope: Overdone plot patterns used without meaningful subversion
- character_type: Flat archetypes played straight ("chosen one", "wise mentor dies", "manic pixie dream girl")
- plot_device: Tired mechanics ("it was all a dream", "convenient amnesia", "long-lost twin")
- description: Hackneyed descriptive language ("cerulean orbs" for eyes, pathetic fallacy used bluntly)

SEVERITY:
- strong: So overused it damages credibility — definitely worth reconsidering
- moderate: Recognizable cliché — consider freshening or intentional use
- subtle: Borderline — may be intentional genre convention or voice

IMPORTANT: Genre conventions are NOT clichés. Romance readers expect certain emotional beats; fantasy readers expect worldbuilding patterns. Only flag patterns that have become so overused they feel stale *within* their genre.

PROSE TO ANALYZE:
{scenes_block}

Respond with a JSON object matching this exact schema:

{{
  "categories": [
    {{
      "name": "category name (e.g., Overused Phrases, Character Tropes, Plot Devices)",
      "count": 2,
      "instances": [
        {{
          "passage": "exact quoted text from the prose — 10–25 words max",
          "cliche_type": "phrase | trope | character_type | plot_device | description",
          "scene_title": "scene title from input",
          "scene_id": "scene id from input",
          "explanation": "one sentence on why this is considered a cliché",
          "severity": "strong | moderate | subtle",
          "intentional_use_case": "when using this intentionally could work (subversion, irony, genre homage, character voice)"
        }}
      ]
    }}
  ],
  "total_count": 5,
  "density_note": "X clichés per 1000 words — brief assessment of frequency",
  "genre_context": "how the story's genre shapes cliché expectations",
  "summary": "2–3 sentence overall assessment of originality and freshness",
  "overall_rating": "needs_work | fair | good | excellent",
  "strengths": ["specific example of fresh, original language or approach"]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- passage: verbatim text excerpted from the scenes above — do not paraphrase
- scene_id: use the id value from the [SCENE: ... | id: ...] header
- Only flag genuine clichés — not genre conventions used purposefully
- If the prose is largely cliché-free, say so clearly with overall_rating "good" or "excellent"
- total_count must equal the sum of all category counts
- overall_rating: needs_work = many strong clichés, fair = several moderate, good = mostly fresh, excellent = consistently original"""


def build_cliche_coach_system_prompt(
    story_title: str,
    scene_title: str,
    genre: str | None,
    selected_text: str,
) -> str:
    """System prompt for the inline Cliche Coach chat session."""

    genre_line = f"Genre: {genre}." if genre else ""

    return f"""You are a thoughtful, encouraging writing coach helping an author examine a passage from their work-in-progress.

Story: "{story_title}"
Scene: "{scene_title}"
{genre_line}

The author has selected this passage for discussion:
"{selected_text}"

Your role is to:
1. Identify any clichéd elements — phrases, tropes, descriptions, character patterns, plot devices
2. Explain WHY something is considered a cliché (its origins, why overuse has dulled it)
3. Help the author make an informed choice by exploring three paths:
   - Freshen it: Point toward original alternatives that preserve the meaning or feeling
   - Subvert it: Show how to twist the expectation to create surprise or irony
   - Use it intentionally: Explain when a cliché can work (character voice, genre homage, deliberate irony)

IMPORTANT PRINCIPLES:
- You are a coach and editor, not a co-author. Point directions — don't write the prose for them.
- Ask questions that help the author discover their own solution.
- Respect genre conventions — what feels clichéd in literary fiction may be beloved convention in romance or cozy mystery.
- If the passage contains no meaningful clichés, say so honestly and briefly, then offer what you do notice about the writing.
- Be warm, specific, and respectful of the author's creative choices. Never be dismissive or condescending."""


def _score_entity_richness(entity_data: dict) -> str:
    """Return 'emerging' | 'developing' | 'established' based on how much data the entity has."""
    # Count non-empty text fields and their total character weight
    filled = 0
    char_count = 0
    for v in entity_data.values():
        if isinstance(v, str) and v.strip():
            filled += 1
            char_count += len(v.strip())
        elif isinstance(v, (list, dict)) and v:
            filled += 1
    # Thresholds: <3 meaningful fields or <150 chars total → emerging
    #             3-6 fields or 150-600 chars → developing
    #             7+ fields or >600 chars → established
    if filled < 3 or char_count < 150:
        return "emerging"
    if filled < 7 or char_count < 600:
        return "developing"
    return "established"


_RICHNESS_GUIDANCE = {
    "emerging": {
        "label": "EMERGING (very little data exists)",
        "instruction": (
            "This entity is barely sketched. Ask foundational questions that help the writer "
            "establish the basics — who/what is this, why do they exist in the story, what makes "
            "them distinct. Questions should be broad enough to open doors, not assume anything."
        ),
        "depth": "foundational — help the writer answer 'what is this entity at its core?'",
    },
    "developing": {
        "label": "DEVELOPING (some data exists but gaps remain)",
        "instruction": (
            "This entity has a foundation but meaningful gaps remain. Ask questions that build "
            "on what is already there — probe the tensions, contradictions, and unexplored edges "
            "that the existing data hints at but doesn't resolve."
        ),
        "depth": "connective — help the writer deepen and complicate what already exists",
    },
    "established": {
        "label": "ESTABLISHED (rich, detailed data exists)",
        "instruction": (
            "This entity is well-developed. Skip the basics. Ask nuanced questions that explore "
            "the interplay between established elements, surface hidden contradictions, challenge "
            "assumptions, or push into the subtext and implication of what's already there. "
            "These questions should feel like the ones only a careful re-read would surface."
        ),
        "depth": "nuanced — challenge and complicate what's already established",
    },
}


def build_discovery_questions_prompt(
    focus_area: str,
    entity_data: dict,
    story_context: dict,
) -> str:
    """Generate thought-provoking discovery questions to help a writer develop a story element.

    focus_area: "character" | "location" | "scene" | "story"
    entity_data: serialized data for the entity being examined
    story_context: basic story info (title, genre, tone)
    """

    story_title = story_context.get("title", "this story")
    genre = story_context.get("genre", "")
    tone = story_context.get("tone", "")

    richness = _score_entity_richness(entity_data)
    richness_meta = _RICHNESS_GUIDANCE[richness]

    genre_line = f"Genre: {genre}." if genre else ""
    tone_line = f"Tone: {tone}." if tone else ""

    # Build entity block based on focus
    if focus_area == "character":
        name = entity_data.get("name", "this character")
        entity_block = f"""CHARACTER: {name}
Role: {entity_data.get("role", "")}
Mission/goal: {entity_data.get("mission_statement", "")}
Personality: {entity_data.get("personality", "")}
Motivation: {entity_data.get("motivation", "")}
Background: {entity_data.get("background", "")}
Appearance: {entity_data.get("appearance", "")}
Arc notes: {entity_data.get("arc_notes", "")}
Narrative intent: {entity_data.get("narrative_intent", "")}
Traits: {", ".join(f"{k}: {v}" for k, v in (entity_data.get("traits") or {}).items() if v)}"""
        area_guidance = """AREAS TO PROBE (choose the most underdeveloped):
- backstory: Origins, formative experiences, family dynamics, what shaped their worldview
- motivation: Goals, fears, contradictions, what they would sacrifice and why
- relationship: How they relate to others — power dynamics, loyalty, conflict patterns
- sensory: Physical mannerisms, voice, how others perceive them in a room
- arc: Key decision points, transformation trajectory, what they must gain or lose
- perspective: Get inside their body on an ordinary day — what do they notice first when entering an unfamiliar room? What physical sensation accompanies their anxiety or excitement? What would they be thinking about on a mundane commute? What sound, smell, or object puts them instantly at ease — or on edge?"""

    elif focus_area == "location":
        name = entity_data.get("name", "this location")
        entity_block = f"""LOCATION: {name}
Type: {entity_data.get("location_type", "")}
Climate: {entity_data.get("climate", "")}
Terrain: {entity_data.get("terrain", "")}
Description: {entity_data.get("description", "")}
Atmosphere: {entity_data.get("atmosphere", "")}
History: {entity_data.get("history", "")}
Significance: {entity_data.get("significance", "")}
Political affiliation: {entity_data.get("political_affiliation", "")}"""
        area_guidance = """AREAS TO PROBE (choose the most underdeveloped):
- sensory: What does it look, smell, sound, feel like at different times of day or season?
- economy: What sustains this place? What do people do here for work and trade?
- culture: Social norms, unspoken rules, local tensions, what outsiders misunderstand
- history: What happened here? What traces remain? What is forgotten or suppressed?
- conflict: What pressures does this place face — political, environmental, social?
- perspective: Put yourself inside this place on an ordinary day — what is playing on the radio or the setting-appropriate equivalent? What does the air smell like at 7am? What do regulars argue about? What would a first-time visitor notice that a local has completely stopped seeing?"""

    elif focus_area == "scene":
        name = entity_data.get("title", "this scene")
        entity_block = f"""SCENE: {name}
Synopsis: {entity_data.get("synopsis", "")}
Entry state: {entity_data.get("entry_state", "")}
Exit state: {entity_data.get("exit_state", "")}
Key events: {", ".join(entity_data.get("key_events") or [])}
POV character: {entity_data.get("pov_character", "")}
Status: {entity_data.get("status", "")}"""
        area_guidance = """AREAS TO PROBE (choose the most underdeveloped):
- purpose: What must this scene accomplish? What changes by the end? What cannot be cut?
- stakes: What is genuinely at risk? What happens if the protagonist fails here?
- subtext: What is being communicated that isn't spoken aloud?
- sensory: What physical anchors ground the reader in this specific place and moment?
- character movement: Who wants what? Who is blocking them? How do power dynamics shift?
- perspective: Step into the POV character's body — what is their posture doing that they're barely aware of? What ambient sounds or smells fill the room that no one comments on? What does the air taste like? What is the one detail their eye keeps returning to, and why?"""

    else:  # story
        name = entity_data.get("title", "this story")
        entity_block = f"""STORY: {name}
Genre: {entity_data.get("genre", "")}
Tone: {entity_data.get("tone", "")}
Themes: {", ".join(entity_data.get("themes") or [])}
Central conflict: {entity_data.get("central_conflict", "")}
Logline: {entity_data.get("logline", "")}
Premise: {entity_data.get("premise", "")}
Narrative intent: {entity_data.get("narrative_intent", "")}"""
        area_guidance = """AREAS TO PROBE (choose the most underdeveloped):
- thematic clarity: What is this story fundamentally about at its deepest level?
- promise: What does the opening promise the reader? Is that promise being kept?
- stakes: Why does this story matter? What is truly at risk beyond plot events?
- transformation: How will the protagonist and/or world be different at the end?
- worldbuilding: What rules govern this world and how do they create or constrain story?
- perspective: What is the texture of an ordinary Tuesday in this world? What do people complain about over dinner? What technology, object, or ritual is so ubiquitous that no one mentions it — but a reader from our world would find strange or revealing?"""

    return f"""You are a thoughtful writing guide helping an author develop their story. Your role is to ask the questions a great developmental editor would ask — questions that help the writer make their own discoveries.

Story: "{story_title}"
{genre_line} {tone_line}

{entity_block}

DEVELOPMENT STAGE: {richness_meta["label"]}
{richness_meta["instruction"]}
Question depth: {richness_meta["depth"]}

{area_guidance}

CRITICAL RULES:
1. Ask questions, never answer them. Never suggest what the answer should be.
2. Calibrate question depth to the development stage above — do not ask advanced nuance questions for an emerging entity, and do not ask basic "what is this?" questions for an established one.
3. Identify GAPS — what data above is absent, vague, or thin? Ask about those areas specifically.
4. Questions should be specific to this entity, not generic writing advice.
5. Each question should feel like it unlocks something worth hours of thinking.
6. "Why it matters" explains the story craft reason — how answering this could deepen the work.
7. Include at least one immersive/perspective question that puts the writer physically inside the experience — sensory, embodied, and grounded in the everyday texture of this entity's world.

Generate 3-5 discovery questions. Respond with this exact JSON schema:

{{
  "questions": [
    {{
      "question": "A specific, probing question about this {focus_area}",
      "context_area": "backstory | motivation | sensory | conflict | relationship | worldbuilding | arc | stakes | culture | economy | subtext | purpose | perspective",
      "why_this_matters": "1-2 sentences on how answering this could deepen the story"
    }}
  ],
  "focus_area": "{focus_area}",
  "entity_name": "{entity_data.get("name", entity_data.get("title", "Unknown"))}",
  "observation": "One sentence noting what seems most underdeveloped or unexplored about this {focus_area}"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- questions: 3-5 items, each distinct in context_area
- Questions must be open-ended (never yes/no)
- Prioritize areas where the entity data above is empty or minimal
- Never write prose for the author or suggest specific story choices"""


# ── Character Dimensionality ──────────────────────────────────────────────────


def build_character_dimensionality_prompt(
    story_title: str,
    story_intent: str | None,
    characters_data: list[dict],
    single_character: bool = False,
) -> str:
    """Build a prompt to assess character dimensionality.

    When single_character=True the list contains exactly one character and the
    prompt returns a single CharacterDimensionEntry wrapped in a one-element
    'characters' array so the response schema stays consistent.
    """

    dimension_scale = """\
DIMENSION SCALE (use exactly these values for dimension_score):
- flat: One defining trait, predictable reactions, no internal conflict or contradiction
- developing: Basic motivation established, some backstory hints, but behavior is still largely one-note
- dimensional: Clear wants/fears/contradictions, relationships feel earned, reader can predict behavior yet still be surprised
- complex: Layered psychology, actions stem from competing internal forces, changes feel inevitable yet unexpected"""

    role_expectations = """\
ROLE EXPECTATIONS — score dimensionality relative to story importance:
- protagonist / antagonist: Should reach at least "dimensional"; anything lower is a craft problem
- supporting: "developing" is appropriate; "flat" warrants a recommendation
- minor: "flat" is acceptable; note only if it undermines a key scene"""

    if single_character:
        char = characters_data[0]
        relationships_block = ""
        if char.get("relationships"):
            rel_lines = "\n".join(
                f"  - {r['other_name']} ({r['relationship_type']}): {r.get('description', '')[:100]}"
                for r in char["relationships"][:8]
            )
            relationships_block = f"Relationships:\n{rel_lines}"

        milestones_block = ""
        if char.get("arc_milestones"):
            m_lines = "\n".join(
                f"  - {'[x]' if m.get('completed') else '[ ]'} {m.get('text', '')}" for m in char["arc_milestones"][:10]
            )
            milestones_block = f"Arc milestones:\n{m_lines}"

        char_block = f"""CHARACTER: {char.get("name", "Unknown")}
Role: {char.get("role", "")}
Personality: {char.get("personality", "")}
Motivation: {char.get("motivation", "")}
Background: {char.get("background", "")}
Appearance: {char.get("appearance", "")}
Arc notes: {char.get("arc_notes", "")}
Narrative intent: {char.get("narrative_intent", "")}
Mission statement: {char.get("mission_statement", "")}
Conflict (what stands in the way): {char.get("conflict", "")}
Epiphany (what they learn): {char.get("epiphany", "")}
Their arc in their own words: {char.get("arc_in_own_words", "")}
Traits: {", ".join(f"{k}: {v}" for k, v in (char.get("traits") or {}).items() if v)}
Scenes featuring this character: {char.get("scene_count", 0)}
{relationships_block}
{milestones_block}"""

    else:
        char_lines = []
        for c in characters_data:
            motivation = (c.get("motivation") or "")[:80]
            personality = (c.get("personality") or "")[:80]
            arc = (c.get("arc_notes") or "")[:80]
            rel_count = c.get("relationship_count", 0)
            milestones = c.get("milestone_count", 0)
            char_lines.append(
                f"- {c['name']} (role={c.get('role', '?')}, scenes={c.get('scene_count', 0)}, "
                f"relationships={rel_count}, milestones={milestones})\n"
                f"  motivation: {motivation or 'none'}\n"
                f"  personality: {personality or 'none'}\n"
                f"  arc: {arc or 'none'}"
            )
        char_block = "CHARACTERS:\n" + "\n".join(char_lines)

    ensemble_instruction = (
        ""
        if single_character
        else '\n  "cast_balance": "Assessment of whether character development matches their role importance",'
        '\n  "ensemble_dynamics": "How well characters contrast, complement, and complicate each other",'
    )

    return f"""You are a character analyst working on the story "{story_title}".

Story intent: {story_intent or "Not specified"}

{char_block}

{dimension_scale}

{role_expectations}

IMPORTANT: Base your assessment on what IS present in the data above. If fields are empty, that is itself evidence of flatness or underdevelopment. Be specific — cite actual details from the data in strengths, gaps, and contradictions.

Respond with this exact JSON schema:

{{
  "characters": [
    {{
      "character_id": "the character's id string",
      "character_name": "character name",
      "role": "protagonist | antagonist | supporting | minor",
      "dimension_score": "flat | developing | dimensional | complex",
      "strengths": ["specific things in the data that make this character feel real or interesting"],
      "gaps": ["specific missing or underdeveloped areas that limit depth"],
      "contradictions": "describe internal tensions present — or explain their absence",
      "relationship_depth": "assess how well-developed their relationships are based on available data",
      "recommendations": ["1-3 specific, actionable suggestions to deepen this character"]
    }}
  ],{ensemble_instruction}
  "summary": "2-3 sentence overall assessment of the cast",
  "overall_rating": "needs_work | fair | good | excellent"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- overall_rating reflects the entire cast: needs_work = flat protagonists or key characters, excellent = all characters appropriately developed
- recommendations must be specific to THIS character's data, not generic writing advice
- Never suggest prose, story choices, or what should happen — only what to develop or explore"""


# ── Voice Fidelity ─────────────────────────────────────────────────────────────


def build_voice_fidelity_prompt(
    character_name: str,
    attributes: dict,
    dialogue_lines: list[str],
) -> str:
    """
    Build a prompt that asks the AI to evaluate whether a character's dialogue
    is authentic to their defined attributes (intelligence, education, social_manner, etc.).

    Key signal: word etymology — Germanic-root words (help, bold, end, buy) indicate
    lower intelligence/education; Latinate/Greek words (assist, audacious, conclusion,
    purchase) indicate higher. The mix should match the character's profile.
    """
    # Gather relevant attribute labels and their expected speech patterns
    attr_sections: list[str] = []
    for key, guidance_map in _ATTR_GUIDANCE.items():
        value = _normalise(attributes.get(key) or "")
        match = next((v for k, v in guidance_map.items() if _normalise(k) == value), None)
        if match:
            label = _ATTR_LABELS.get(key, key.replace("_", " ").title())
            raw_val = attributes.get(key, "")
            attr_sections.append(f"**{label} ({raw_val}):** {match}")

    if not attr_sections:
        attribute_block = "No specific attributes have been defined for this character."
    else:
        attribute_block = "\n\n".join(attr_sections)

    dialogue_block = "\n".join(f'- "{line}"' for line in dialogue_lines) if dialogue_lines else "(no dialogue found)"

    return f"""You are evaluating whether the dialogue written for a character is authentic to their defined profile.

CHARACTER: {character_name}

DEFINED ATTRIBUTES AND EXPECTED SPEECH PATTERNS:
{attribute_block}

KEY LINGUISTIC SIGNAL — WORD ETYMOLOGY:
Word origins are one of the strongest markers of intelligence and education level:
- Germanic-root words (help, bold, end, start, buy, think, begin, house, strong) → expected for simple/average intelligence or common/unlettered education
- Latinate or Greek-root words (assist, audacious, conclusion, commence, purchase, contemplate, initiate, domicile, robust) → expected for brilliant/sharp intelligence or scholarly/educated characters
- The MIX of word origins should align with the character's intelligence and education level. An "unlettered" character using "facilitate" or "expedite" is a red flag. A "brilliant" character never escaping Anglo-Saxon vocabulary is also a signal.

DIALOGUE TO EVALUATE:
{dialogue_block}

Evaluate each line of dialogue against the character's attributes. Flag lines that feel inconsistent with their intelligence, education, or social manner. Also identify lines that feel authentically right.

Respond with ONLY valid JSON matching this exact schema:

{{
  "character_name": "{character_name}",
  "attribute_summary": "One sentence summarizing the key speech expectations based on their attributes",
  "findings": [
    {{
      "dialogue_excerpt": "the specific dialogue line (truncated if long)",
      "issue_type": "etymology_mismatch | vocabulary_mismatch | formality_drift | education_inconsistency | manner_conflict | authentic",
      "severity": "issue | warning | info",
      "explanation": "why this line does or does not match the character's profile",
      "attribute_context": "which attribute(s) are relevant (e.g. intelligence: simple, education: unlettered)",
      "suggestion": "how to revise the line to match the character (leave empty if authentic)"
    }}
  ],
  "authentic_examples": ["dialogue lines that ring true to the character's voice — at most 5"],
  "overall_fidelity": "excellent | good | fair | needs_work",
  "summary": "2-3 sentence overall assessment of how well the dialogue matches the character's attributes",
  "recommendations": ["1-3 specific, actionable suggestions for bringing the dialogue into alignment"]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Only include findings for lines that are notable — either because they are inconsistent (issue/warning) or because they are excellent examples of authentic voice (info/authentic). Do not flag every single line.
- overall_fidelity: excellent = nearly all lines match well; good = mostly authentic with minor slips; fair = noticeable inconsistencies; needs_work = dialogue regularly contradicts the character's defined attributes
- Be specific — quote the actual words or phrases that signal the mismatch
- recommendations should be concrete writing guidance, not generic advice"""
