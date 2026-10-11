"""
The demo stage play (doc 25, P9): "The Last Lighthouse: A Play in One Act", the novel's first
night told for the theatre. It shows the same element model as the screenplay laid out as a play:
scene markers, stage directions in italics from halfway across, names centred over full-width
speeches, a line said at once, and END OF PLAY.
"""

from sqlalchemy.orm import Session

from ..config import settings
from ..database import engine
from ..models import Character, Location, Story, User
from ..models.location import SceneSetting
from ..models.structure import StructureNode
from .script_scene import derive_heading
from .seed_screenplay import adapted_from_novel, script_html
from .word_count import recount_story

TITLE = "The Last Lighthouse: A Play in One Act"

THE_DOOR = [
    ("heading", "SCENE 1"),
    (
        "action",
        "The keeper's cottage, under a lighthouse on a dying island. Night. Rain against the one window. "
        "A table, two chairs, and a shelf of logbooks, spine to spine.",
    ),
    (
        "action",
        "ELEANOR VANCE, in her forties, sits with a cup of tea she is not drinking. Three knocks. She does not move.",
    ),
    ("cue", "ELEANOR"),
    ("paren", "(to herself)"),
    ("dialogue", "Don't open the door."),
    ("action", "She opens the door. THE VISITOR stands in the downpour as if it were a light drizzle."),
    ("cue", "THE VISITOR"),
    ("dialogue", "You're Eleanor Vance."),
    ("cue", "ELEANOR"),
    ("dialogue", "Who's asking?"),
    ("cue", "THE VISITOR"),
    ("dialogue", "Someone who came a long way to read your father's logs."),
    ("action", "A long moment. Eleanor steps back to let her in."),
    ("transition", "BLACKOUT."),
]

THE_LOGS = [
    ("heading", "SCENE 2"),
    (
        "action",
        "Later. The storm has eased. The Visitor, dry in one of Eleanor's jumpers, turns the pages of a "
        "logbook. Eleanor watches from the window.",
    ),
    ("cue", "THE VISITOR"),
    ("dialogue", "There's a month missing."),
    ("cue", "ELEANOR"),
    ("dialogue", "March."),
    ("cue", "THE VISITOR ^"),
    ("dialogue", "March."),
    ("action", "They look at each other. The beam of the lighthouse crosses the window, and is gone."),
    ("transition", "BLACKOUT."),
    ("centered", "END OF PLAY"),
]


def seed_stage_play_demo() -> None:
    with Session(engine) as db:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if not admin or db.query(Story).filter(Story.title == TITLE).first():
            return

        story = Story(
            user_id=admin.id,
            title=TITLE,
            story_format="stage_play",
            structure_template_id="stage-play",
            intended_length="one_act",
            description="The Last Lighthouse for the stage: one room, one storm, and a stranger who knows her name.",
            genre="Drama",
            tone="Spare, quietly tense",
            themes=["solitude", "memory", "secrets"],
            logline="A lighthouse keeper lets a stranger in from a storm, and the stranger has come for the one "
            "month of her father's logs that was cut out.",
            narrative_intent="Show the novel's first night as a play: one room, what the audience sees and hears.",
            title_page={"based_on": "Based on the novel The Last Lighthouse", "draft": "First draft"},
        )
        db.add(story)
        db.flush()

        db.add_all(
            [
                Character(
                    story_id=story.id,
                    name="Eleanor Vance",
                    aliases=["Eleanor"],
                    color_slot=1,
                    role="protagonist",
                    pronouns="she/her",
                    personality="Solitary, observant, quietly stubborn. Says no more than she needs to.",
                ),
                Character(
                    story_id=story.id,
                    name="The Visitor (Calder)",
                    color_slot=2,
                    role="deuteragonist",
                    pronouns="she/her",
                    personality="Calm in a way that doesn't fit the storm she arrived in.",
                ),
            ]
        )
        cottage = Location(story_id=story.id, name="Keeper's Cottage", location_type="building")
        db.add(cottage)
        act = StructureNode(story_id=story.id, level=0, level_type="act", title="Act One", position=0)
        db.add(act)
        db.flush()

        scenes = [
            ("The Door", "The Visitor arrives in the storm, and knows Eleanor's name.", THE_DOOR),
            ("The Logs", "The Visitor finds the month cut out of the logs.", THE_LOGS),
        ]
        for i, (title, synopsis, blocks) in enumerate(scenes):
            scene = StructureNode(
                story_id=story.id,
                parent_id=act.id,
                level=1,
                level_type="scene",
                title=title,
                synopsis=synopsis,
                position=i,
                status="draft",
                content=script_html(blocks),
            )
            db.add(scene)
            db.flush()
            db.add(SceneSetting(location_id=cottage.id, node_id=scene.id, role="primary"))
            db.flush()
            derive_heading(scene, story, db)

        adapted_from_novel(db, story, {"The Door": "Knock at the Door", "The Logs": "The Logbook"})
        recount_story(story.id, db)
        db.commit()
