"""
Show, don't tell: passages that state what could be shown. For a script (doc 25, P7) the same
question is asked for the screen, as unfilmables: action a camera could not film.
"""


def build_show_dont_tell_prompt(
    prose_text: str,
    story_title: str,
    genre: str | None = None,
    tone: str | None = None,
    script: bool = False,
) -> str:
    """Structured JSON prompt to identify 'telling' passages and suggest 'showing' alternatives."""
    context_parts = []
    if genre:
        context_parts.append(f"Genre: {genre}")
    if tone:
        context_parts.append(f"Tone: {tone}")
    context_block = "\n".join(context_parts) if context_parts else ""

    if script:
        return _unfilmables(prose_text, story_title, context_block)
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


def _unfilmables(script_text: str, story_title: str, context_block: str) -> str:
    """Show, don't tell for the screen (doc 25, P7): action a camera could not film."""
    return f"""You are a script editor reading the screenplay "{story_title}" for unfilmables: action lines that tell the reader what no camera could film and no actor could play.

{context_block}

WHAT TO LOOK FOR (in action lines only; a character's dialogue is theirs to say):
- emotion: a thought or feeling stated ("She is furious." / "He realizes she lied.")
- state: an inner condition or a fact the image cannot carry ("He has not slept in days.")
- quality: the writer's judgment instead of an image ("The most beautiful room in the city.")
- exposition: backstory or information only the page knows ("Ten years ago, she lost her brother here.")

SEVERITY LEVELS:
- strong: nothing on screen would carry it; the audience will never know
- moderate: the image is there, but the line leans on telling it
- subtle: a common screenwriting shorthand that may be fine; note but don't overweight

NOTE: A little telling in action is normal for tone and pace. Only flag lines where the audience would miss something the writer meant them to have.

THE SCRIPT (Fountain):
{script_text}

Respond with a JSON object matching this exact schema:

{{
  "instances": [
    {{
      "passage": "the exact words from the action line (quote it precisely)",
      "severity": "strong | moderate | subtle",
      "issue_type": "emotion | state | quality | exposition",
      "explanation": "1 sentence explaining why this is telling and what it flattens",
      "question": "one short question that would lead the author to show it instead (e.g. 'what does the camera see that tells us?')"
    }}
  ],
  "summary": "2-3 sentence overall assessment of how well the action lines play on screen",
  "overall_rating": "needs_work | fair | good | excellent",
  "strengths": [
    "specific thing the action does well in putting it on screen"
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
