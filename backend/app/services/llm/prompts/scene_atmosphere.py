"""
Sensory cues from reference images (doc 06 §5: was prose, now prompts).

This feature used to ask for "atmospheric description… like a seasoned author's
scene-setting paragraphs" and a "suggested opening sentence a writer could adapt" — a
ghostwriter with extra steps. It now returns short cues per sense: enough to write from,
never anything to paste.
"""

SCENE_ATMOSPHERE_SYSTEM = (
    "You help a fiction author notice what is in their reference images. "
    "You return short sensory cues — words and fragments, never sentences — that the author "
    "will turn into their own prose. "
    "You do not write description, opening lines, or anything that could be pasted into a manuscript."
)

_SENSES = ("Sight", "Sound", "Texture and temperature", "Smell and taste", "Movement")


def build_scene_atmosphere_prompt(
    num_images: int,
    user_query: str | None = None,
    scene_title: str | None = None,
    scene_synopsis: str | None = None,
) -> str:
    parts = []
    if scene_title:
        parts.append(f"Scene title: {scene_title}")
    if scene_synopsis:
        parts.append(f"Scene synopsis: {scene_synopsis}")
    senses = "\n".join(f"### {s}" for s in _SENSES)
    parts.append(
        f"Here {'are' if num_images != 1 else 'is'} {num_images} reference "
        f"image{'s' if num_images != 1 else ''} for a scene I am writing.\n\n"
        "Give me sensory cues to write from, under these headings:\n\n"
        f"{senses}\n\n"
        "Rules:\n"
        "- 5 to 8 cues per heading, each two to four words. Fragments, not sentences.\n"
        "- Only what the images actually show or imply — no invented history, no story.\n"
        "- Finish with one question about what this place should feel like to the "
        "point-of-view character.\n"
        "- Do not write description, an opening line, or any sentence I could paste."
    )
    if user_query:
        parts.append(f"\nAdditional request: {user_query}")
    return "\n\n".join(parts)
