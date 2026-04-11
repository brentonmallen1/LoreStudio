"""Prompts for AI-assisted pronoun refactoring."""


def build_pronoun_refactor_prompt(
    character_name: str,
    new_pronouns: str,
    scene_content: str,
) -> str:
    """Build prompt for AI to find and rewrite gendered language for a character."""
    return f"""You are a careful prose editor helping an author update a character's pronouns while preserving their narrative voice.

CHARACTER: {character_name}
NEW PRONOUNS: {new_pronouns}

TASK:
Identify all pronouns and gendered language in the scene that refer specifically to {character_name}, and propose rewrites using {new_pronouns}.

Only rewrite language that unambiguously refers to {character_name}. Do not guess on ambiguous pronouns shared between multiple characters.

CRITICAL: Preserve the author's style, rhythm, vocabulary, and sentence structure exactly. Only change what is necessary for the pronoun update. Do not rephrase or improve sentences beyond the pronoun change.

SCENE CONTENT:
{scene_content}

OUTPUT FORMAT:
Return a JSON object with a "rewrites" array. Each item must have:
- "original": the exact phrase from the text that needs changing (enough context to be unique — typically 5–15 words)
- "rewritten": the same phrase with updated pronouns/gendered language
- "explanation": one short phrase describing what changed (e.g., "he → they", "his coat → their coat")

Example:
{{
  "rewrites": [
    {{
      "original": "He reached for the lamp",
      "rewritten": "They reached for the lamp",
      "explanation": "he → they"
    }}
  ]
}}

If no changes are needed (no pronouns found for this character), return {{"rewrites": []}}.
Do not include passages that require no change."""
