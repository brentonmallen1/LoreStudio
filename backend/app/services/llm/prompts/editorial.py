"""
LLM prompts for the Editorial Pass feature.

Five analyses that together simulate a developmental editor reading the manuscript:
  1. Fresh Eyes + Reader Experience
  2. Tiered Revision Priorities
  3. Intent vs Execution Gap
  4. Voice Characterization
  5. Marginal Commentary (passage-anchored notes)
"""


def build_fresh_eyes_prompt(
    story_title: str,
    story_intent: str | None,
    genre: str | None,
    sections: list[dict],  # [{"title": str, "content": str, "purpose": str}]
    context_level: str,
) -> str:
    context_note = {
        "full": "You have the full manuscript.",
        "summaries": "You have scene summaries as compressed context (no full prose).",
        "section": "You have only the selected section — no cross-section context.",
    }.get(context_level, "")

    sections_block = "\n\n".join(
        f"=== {s['title']} ===\n"
        + (f"Purpose: {s['purpose']}\n" if s.get("purpose") else "")
        + (s["content"] or "(no content)")
        for s in sections
    )

    return f"""You are a first-time reader of "{story_title}" — you know nothing beyond what is on the page.
{context_note}
Genre: {genre or "unspecified"}
Story intent: {story_intent or "Not specified"}

Your task: For each section, identify questions, confusions, or wrong assumptions a first-time reader would have at that point. This surfaces "writer blindness" — things obvious to the author but invisible to the reader.

Think about:
- Information the reader doesn't have yet but needs
- Assumptions the author is making that aren't on the page
- Character motivations or decisions that feel unmotivated
- Reader emotional experience at each moment
- Moments where the reader would be confused, disengaged, or wrongly predicting what happens next

STORY CONTENT:
{sections_block}

Respond with a JSON object in this exact format:
{{
  "questions": [
    {{
      "section_title": "exact section title from above",
      "question": "A first-time reader would wonder: [specific question or confusion]",
      "context": "brief explanation of what in the text triggered this",
      "anchor": "a short exact quote from the text that triggered the question, or empty string"
    }}
  ],
  "summary": "2-3 sentence overall assessment of reader experience and major blind spots"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Be specific — not "pacing is slow" but "the reader has no reason to care about X yet because Y hasn't been established"
- anchor must be a verbatim short excerpt (under 80 chars) or empty string ""
- Include 2-6 questions per section, focusing on the most impactful reader confusions
- Prioritize questions that reveal genuine writer blindness over surface-level issues"""


def build_priorities_prompt(
    story_title: str,
    story_intent: str | None,
    sections: list[dict],  # [{"title": str, "content": str, "purpose": str, "synopsis": str}]
    context_level: str,
) -> str:
    context_note = {
        "full": "You have the full manuscript.",
        "summaries": "You have scene summaries as compressed context.",
        "section": "You have only the selected section.",
    }.get(context_level, "")

    sections_block = "\n\n".join(
        f"=== {s['title']} ===\n"
        + (f"Purpose: {s['purpose']}\n" if s.get("purpose") else "")
        + (f"Synopsis: {s['synopsis']}\n" if s.get("synopsis") else "")
        + (s["content"] or "(no content)")
        for s in sections
    )

    return f"""You are a developmental editor reviewing "{story_title}".
{context_note}
Story intent: {story_intent or "Not specified"}

Your task: Identify the top revision priorities — the things that, if fixed, would most improve the reader's experience. Do NOT list every issue. Focus on high-impact problems.

Think about: Structural problems, missing setup/payoff, character motivation gaps, scenes that don't earn their place, promises made but not kept.

STORY CONTENT:
{sections_block}

Respond with a JSON object in this exact format:
{{
  "priorities": [
    {{
      "rank": 1,
      "section_title": "exact section title, or 'Whole Story' for story-level issues",
      "issue": "brief statement of the problem",
      "suggestion": "specific actionable suggestion — not generic advice",
      "impact": "high | medium | low",
      "anchor": "short exact quote (under 80 chars) that exemplifies the issue, or empty string"
    }}
  ],
  "overall_note": "1-2 sentences on the most important thing to address in this revision pass"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Rank 1 is the highest priority
- List 3-8 priorities total — fewer is better if they're truly the most important
- impact "high" = affects core reader experience; "medium" = noticeable but not fatal; "low" = polish
- Suggestions must be specific: not "improve pacing" but "Scene X establishes the stakes too late — move the confrontation to the second paragraph"
- anchor must be a verbatim short excerpt or empty string """""


def build_intent_gap_prompt(
    story_title: str,
    story_intent: str | None,
    sections: list[dict],  # [{"title": str, "content": str, "purpose": str, "synopsis": str}]
) -> str:
    sections_block = "\n\n".join(
        f"=== {s['title']} ===\n"
        + (f"Author stated purpose: {s['purpose']}\n" if s.get("purpose") else "Author stated purpose: not specified\n")
        + (f"Author synopsis: {s['synopsis']}\n" if s.get("synopsis") else "")
        + (s["content"] or "(no content)")
        for s in sections
    )

    return f"""You are a developmental editor reviewing "{story_title}".
Overall story intent: {story_intent or "Not specified"}

Your task: Compare what the author INTENDED each section to do (from their stated purpose/synopsis) with what the prose ACTUALLY does. Flag meaningful gaps between plan and execution.

Focus on cases where:
- The stated purpose says "tension building" but the prose is static
- The synopsis describes events that aren't in the prose
- Character goals stated in purpose don't appear in the actual scene
- The emotional arc intended is absent from the writing

STORY CONTENT (with author-stated purposes):
{sections_block}

Respond with a JSON object in this exact format:
{{
  "gaps": [
    {{
      "section_title": "exact section title",
      "stated_intent": "what the author said this section should do",
      "execution": "what the prose actually does",
      "gap": "the specific disconnect between intent and execution",
      "suggestion": "concrete suggestion to close the gap",
      "anchor": "short exact quote (under 80 chars) that illustrates the gap, or empty string"
    }}
  ],
  "sections_aligned": ["title of section where intent and execution match well"],
  "summary": "1-2 sentence overall assessment of intent-execution alignment"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Only report meaningful gaps — skip sections with no stated purpose or where execution matches intent well
- sections_aligned should list titles where you found good alignment (positive reinforcement)
- anchor must be a verbatim short excerpt or empty string ""
- If a section has no stated purpose, skip it (cannot assess gap without intent)"""


def build_voice_prompt(
    story_title: str,
    genre: str | None,
    tone: str | None,
    sections: list[dict],  # [{"title": str, "content": str}]
    context_level: str,
) -> str:
    context_note = {
        "full": "You have the full manuscript to compare voice across.",
        "summaries": "You have summaries — voice analysis will be approximate.",
        "section": "You have only one section — voice consistency across chapters cannot be assessed.",
    }.get(context_level, "")

    # For voice analysis, use actual prose only
    sections_block = "\n\n".join(
        f"=== {s['title']} ===\n{s['content'] or '(no content)'}"
        for s in sections
    )

    return f"""You are a prose editor analyzing the narrative voice in "{story_title}".
{context_note}
Genre: {genre or "unspecified"} | Tone: {tone or "unspecified"}

Your task: Characterize the prose voice and identify where it stays consistent or drifts.

Voice includes: sentence length and rhythm, diction level (formal/casual), narrative distance (close/distant POV), use of interiority, authorial personality, cadence.

STORY CONTENT:
{sections_block}

Respond with a JSON object in this exact format:
{{
  "overall_voice": "Describe the prose voice in 2-3 sentences. Be specific and evocative — not 'clear and engaging' but 'first-person, clipped sentences, dry wit, close interiority'",
  "sections": [
    {{
      "section_title": "exact section title",
      "observation": "what the voice sounds like in this section specifically",
      "anchor": "a short representative quote (under 80 chars) that exemplifies the voice here, or empty string",
      "deviation": true/false
    }}
  ],
  "consistency_rating": "consistent | minor-drift | significant-drift",
  "summary": "1-2 sentences on voice consistency and where to focus attention"
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- deviation=true only when a section noticeably departs from the overall voice you defined
- Be concrete about voice — quote or describe specific stylistic choices
- anchor must be a verbatim short excerpt or empty string ""
- If context_level is "section" and there's only one section, still characterize that voice but note you cannot assess consistency"""


def build_marginal_notes_prompt(
    story_title: str,
    story_intent: str | None,
    sections: list[dict],  # [{"title": str, "content": str}]
) -> str:
    sections_block = "\n\n".join(
        f"=== {s['title']} ===\n{s['content'] or '(no content)'}"
        for s in sections
    )

    return f"""You are a developmental editor leaving marginal notes on "{story_title}".
Story intent: {story_intent or "Not specified"}

Your task: Leave specific, anchored comments on individual passages — the way an editor writes in the margins. These are NOT high-level structural notes (those come from other analyses). These are passage-level observations.

Leave notes on:
- A strong passage that works well (type: strength) — acknowledge what's working
- A specific line or paragraph where the prose buries the point (type: concern)
- A transition or beat that needs attention (type: concern)
- A concrete, localized suggestion for a specific passage (type: suggestion)

STORY CONTENT:
{sections_block}

Respond with a JSON object in this exact format:
{{
  "notes": [
    {{
      "section_title": "exact section title",
      "anchor": "the EXACT verbatim passage you're commenting on (under 100 chars) — must be findable in the text",
      "comment": "the marginal note — specific, direct, useful",
      "type": "strength | concern | suggestion"
    }}
  ]
}}

Rules:
- Output ONLY valid JSON. No markdown, no extra text.
- anchor MUST be an exact verbatim excerpt from the text — not paraphrased. It will be used to highlight the passage.
- Leave 1-4 notes per section, mixing types (don't only flag concerns)
- Comments should read like an editor talking to the author: direct, specific, collegial
- Avoid generic advice ("show don't tell") — always tie the note to the specific passage"""
