"""A small story with something to find in it (doc 12 P3).

Two chapters of three written scenes and a third, empty chapter. "Elenor" in the second
scene is one letter from Eleanor; Margaret is in the first scene and none of the last five.
"""

import uuid

from sqlalchemy.orm import Session

from app.models import Character, Story, StructureNode, User


def _uid() -> str:
    return str(uuid.uuid4())


SCENES = {
    "Arrival": "<p>Eleanor climbed the stairs while Margaret watched from the door.</p>",
    "The Lamp": "<p>Elenor lit the lamp and listened to the sea below the rocks.</p>",
    "Supper": "<p>Eleanor ate alone and counted the ships passing the point.</p>",
    "The Storm": "<p>Eleanor held the rail as the storm came over the water.</p>",
    "Morning": "<p>Eleanor woke to a grey and quiet sky above the tower.</p>",
    "The Letter": "<p>Eleanor read the letter twice and put it in the fire.</p>",
}


def build_findings_story(db: Session, user: User, *, chapters: bool = True) -> tuple[Story, dict[str, StructureNode]]:
    story = Story(id=_uid(), user_id=user.id, title="Findings Story")
    db.add(story)
    db.flush()
    db.add_all(
        [
            Character(id=_uid(), story_id=story.id, name="Eleanor Vance", role="protagonist"),
            Character(id=_uid(), story_id=story.id, name="Margaret Holt", role="deuteragonist"),
        ]
    )
    nodes: dict[str, StructureNode] = {}
    titles = list(SCENES)
    groups = [titles[:3], titles[3:], []] if chapters else [titles]
    for ci, group in enumerate(groups):
        parent = None
        if chapters:
            parent = StructureNode(
                id=_uid(), story_id=story.id, title=f"Chapter {ci + 1}", level=0, level_type="chapter", position=ci
            )
            db.add(parent)
            db.flush()
            nodes[parent.title] = parent
        for si, title in enumerate(group):
            scene = StructureNode(
                id=_uid(),
                story_id=story.id,
                parent_id=parent.id if parent else None,
                title=title,
                level=1 if parent else 0,
                level_type="scene",
                position=si,
                content=SCENES[title],
                word_count=len(SCENES[title].split()),
            )
            db.add(scene)
            nodes[title] = scene
    db.commit()
    return story, nodes
