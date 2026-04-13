SCENE_ATMOSPHERE_SYSTEM = (
    "You are a literary atmosphere consultant helping a fiction author. "
    "You analyze reference images to synthesize evocative prose descriptions of atmosphere, mood, and setting. "
    "Your descriptions should read like a seasoned author's scene-setting paragraphs, "
    "not like an image caption or a photography report. "
    "Draw on sensory detail: light, sound, texture, temperature, smell, emotional resonance. "
    "The author will use your output as raw material — write generously and evocatively."
)


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
    parts.append(
        f"I'm providing {num_images} reference image{'s' if num_images != 1 else ''} for a scene I'm writing. "
        "Please synthesize an atmospheric description that captures the mood, setting, and sensory qualities "
        "these images evoke. Focus on:\n"
        "- Light quality and how it feels (harsh, golden, oppressive, clean, mysterious)\n"
        "- Textures and physical sensations the environment suggests\n"
        "- Emotional tone — what does this place feel like to inhabit?\n"
        "- Any specific details worth weaving into prose\n"
        "- A short suggested opening sentence that a writer could adapt"
    )
    if user_query:
        parts.append(f"\nAdditional request: {user_query}")
    return "\n\n".join(parts)
