"""Prompt for LLM-assisted pronoun identification.

The LLM's only job is to identify which pronouns and gendered terms in the text
refer to a specific character. It does NOT rewrite any prose — substitution is
handled deterministically by pronoun_service.py.
"""


def build_pronoun_identification_prompt(
    character_name: str,
    scene_content: str,
) -> str:
    """Ask the LLM to identify pronouns/gendered terms referring to a character.

    The LLM returns a list of exact strings found in the text. It never
    generates replacement text — substitution is done via a lookup table.
    """
    return f"""You are analyzing prose to identify pronouns and gendered language that refer to a specific character.

CHARACTER: {character_name}

TASK:
Read the scene below and list every pronoun or gendered term that unambiguously refers to {character_name}.

Include: subject pronouns (he, she), object pronouns (him, her), possessive determiners (his, her, their used for this character), possessive pronouns (his, hers), reflexive pronouns (himself, herself), and gendered nouns used as references (the man, the woman, the boy, the girl — only when clearly referring to {character_name}).

STRICT RULES:
- Only include terms that unambiguously refer to {character_name}. When two characters share a pronoun and it's unclear which one is meant, skip it.
- Copy the term EXACTLY as it appears in the text, including surrounding context of 6–10 words to make it uniquely locatable.
- Do NOT rewrite, improve, or paraphrase anything. You are only identifying, not editing.

SCENE CONTENT:
{scene_content}

OUTPUT FORMAT:
Return a JSON object with an "instances" array. Each item:
- "exact_text": the exact phrase from the text (6–10 words of context including the pronoun/term)
- "target_word": the specific pronoun or gendered word within that phrase
- "word_type": one of "subject" | "object" | "possessive_det" | "possessive_pron" | "reflexive" | "gendered_noun"

Example:
{{
  "instances": [
    {{
      "exact_text": "She reached for the lamp on the table",
      "target_word": "She",
      "word_type": "subject"
    }},
    {{
      "exact_text": "the coat she had worn since her arrival",
      "target_word": "her",
      "word_type": "possessive_det"
    }}
  ]
}}

If no pronouns for {character_name} are found, return {{"instances": []}}."""
