"""What they talk about (doc 20 P7): the second part of the Bechdel–Wallace test, described."""

from __future__ import annotations


def build_talk_subjects_prompt(exchanges: list[dict], men: list[str]) -> str:
    """Ask for a few words per exchange and whether it is about a man, never a verdict."""
    blocks = "\n\n".join(
        f"[{e['id']}] in “{e['scene']}”:\n" + "\n".join(f"  {line}" for line in e["lines"]) for e in exchanges
    )
    who = ", ".join(men) if men else "none named"
    return f"""Below are conversations from a story, each marked with an id in brackets. For each one, say in a few words (no more than eight) what the people are talking about, and whether that subject is a man.

The men in this story, as the author describes them: {who}. A conversation is about a man when its subject is one of these men, or a man who is not named; it is not about a man when he is only mentioned in passing.

Describe; do not judge the writing, the characters or the story, and do not say whether anything passes or fails a test.

CONVERSATIONS:
{blocks}

Respond with JSON only:
{{"exchanges": [{{"id": "the id", "about": "a few words", "about_a_man": true or false}}]}}"""
