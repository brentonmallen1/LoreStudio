"""Tropes in play, said to the model (doc 27).

The packet carries each trope as the author's stance and why, never the definition: a model
knows what a Noble Bigot is; it cannot guess that this one is meant to be subverted.
"""


def render_story_tropes(story: dict) -> list[str]:
    tropes = story.get("tropes") or []
    if not tropes:
        return []
    return ["Tropes in play across the story (the author's stance on each):", *(f"- {t}" for t in tropes)]


def render_character_tropes(character: dict) -> list[str]:
    tropes = character.get("tropes") or []
    return [f"Tropes they carry: {'; '.join(tropes)}"] if tropes else []


def render_scene_tropes(ctx: dict) -> list[str]:
    tropes = ctx.get("tropes_in_scene") or []
    if not tropes:
        return []
    lines = ["", "## Tropes that play in this scene"]
    for t in tropes:
        line = f"- {t['name']} — {t['stance']}"
        if t.get("why"):
            line += f": {t['why']}"
        if t.get("note"):
            line += f" (here: {t['note']})"
        lines.append(line)
    return lines
