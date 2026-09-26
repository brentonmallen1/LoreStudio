"""Dialogue rows for tests that need a character to speak in a scene."""

from app.models.dialogue import DialogueBlock


def attributed(scene, character, line: str) -> DialogueBlock:
    """A line of the scene's prose that the author attributed by hand, as the Dialogue tab does.

    Rows are derived from the prose, and one the prose does not back is deleted on the next
    read, so `line` must be in the scene. A hand attribution is how a character speaks there
    without being named in it.
    """
    return DialogueBlock(
        scene_id=scene.id,
        character_id=character.id,
        speaker_name=character.name,
        content=line,
        raw_text=f'"{line}"',
        paragraph_index=0,
        position_in_paragraph=0,
        attribution_method="manual",
        confidence=1.0,
    )
