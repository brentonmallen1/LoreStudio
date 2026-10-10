"""
The demo screenplay (doc 25): "The Last Lighthouse: The Screenplay", the novel's first three
scenes written for the screen. It shows a script in the editor (scene headings, action, cues,
parentheticals, dialogue, transitions), its length in pages, and the same story told in two
formats beside each other.

Scenes are written as (element, text) pairs, the shape services/script_syntax.py reads, and
stored as the editor stores them: `<p data-el="cue">ELEANOR</p>`.
"""

from html import escape

from sqlalchemy.orm import Session

from ..config import settings
from ..database import engine
from ..models import Character, Location, Story, User
from ..models.location import SceneSetting
from ..models.structure import StructureNode
from .script_scene import derive_heading
from .word_count import recount_story

TITLE = "The Last Lighthouse: The Screenplay"

THE_LIGHT = [
    ("heading", "INT. LIGHTHOUSE, LAMP ROOM - DUSK"),
    ("action", "The great lens waits, unlit. Beyond the glass the sea has gone very still, as if drawing a breath."),
    ("action", "ELEANOR VANCE (40s, weathered, unhurried) writes in a leather logbook: 1012. 1008. 1003."),
    ("cue", "ELEANOR (V.O.)"),
    ("paren", "(her father's words)"),
    (
        "dialogue",
        "The glass doesn't lie. People lie. Weather lies sometimes too, but the glass is always honest about what it knows.",
    ),
    (
        "action",
        "The lamp blooms on. Its beam sweeps the water, and catches a small boat riding the swell where no boat should be.",
    ),
    ("action", "Eleanor lowers the pen."),
    ("transition", "CUT TO:"),
]

KNOCK = [
    ("heading", "INT. KEEPER'S COTTAGE - NIGHT"),
    ("action", "Rain hammers the window. Eleanor sits at the table with a cup of tea she isn't drinking."),
    ("action", "A KNOCK. Three of them, unhurried."),
    ("action", "She doesn't move. Another knock."),
    ("cue", "ELEANOR"),
    ("paren", "(to herself)"),
    ("dialogue", "Don't open the door."),
    ("action", "She opens the door."),
    (
        "action",
        "THE VISITOR (50s, grey-haired, canvas jacket soaked through) stands in the downpour as if she has stepped "
        "off a bus in light drizzle. She looks at Eleanor the way you look at a landmark you have steered by for years.",
    ),
    ("cue", "THE VISITOR"),
    ("dialogue", "You're Eleanor Vance."),
    ("cue", "ELEANOR"),
    ("dialogue", "Who's asking?"),
    ("cue", "THE VISITOR"),
    ("dialogue", "I'm sorry to impose. The boat... I didn't have much choice about the boat."),
    ("action", "Eleanor steps back to let her in. Later she will wonder why."),
]

LOGBOOK = [
    ("heading", "INT. KEEPER'S COTTAGE - LATER"),
    (
        "action",
        "The Visitor, dry now in one of Eleanor's jumpers, cradles a mug. Her eyes keep going to the shelf: "
        "forty years of logbooks, spine to spine.",
    ),
    ("cue", "THE VISITOR"),
    ("dialogue", "Are those the keeper's logs?"),
    ("cue", "ELEANOR"),
    ("dialogue", "My father's. And his father's."),
    ("cue", "THE VISITOR"),
    ("paren", "(carefully)"),
    ("dialogue", "Would you let me read them?"),
    ("action", "A long beat. Eleanor takes down a volume and sets it on the table between them like a dare."),
    ("action", "The Visitor turns pages. Stops. Turns back."),
    ("cue", "THE VISITOR (CONT'D)"),
    ("dialogue", "There's a month missing."),
    ("action", "Eleanor leans in. Where March 1987 should be, the stubs of cut pages."),
    ("transition", "FADE OUT."),
]


def script_html(blocks: list[tuple[str, str]]) -> str:
    """Blocks as the editor stores them."""
    return "".join(f'<p data-el="{el}">{escape(text, quote=False)}</p>' for el, text in blocks)


def seed_screenplay_demo() -> None:
    with Session(engine) as db:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if not admin or db.query(Story).filter(Story.title == TITLE).first():
            return

        story = Story(
            user_id=admin.id,
            title=TITLE,
            story_format="screenplay",
            structure_template_id="screenplay",
            description="The Last Lighthouse written for the screen: a keeper, a storm, and a stranger who knows her name.",
            genre="Drama",
            tone="Atmospheric, quietly tense",
            themes=["solitude", "memory", "secrets"],
            logline="A lighthouse keeper alone on a dying island lets a stranger in from a storm, and the stranger "
            "has come for the one month of her father's logs that was cut out.",
            narrative_intent="Show the novel's opening told as a script: what the camera sees, and what people say.",
            author_name="",
        )
        db.add(story)
        db.flush()

        eleanor = Character(
            story_id=story.id,
            name="Eleanor Vance",
            aliases=["Eleanor"],
            color_slot=1,
            role="protagonist",
            pronouns="she/her",
            personality="Solitary, observant, quietly stubborn. Says no more than she needs to.",
        )
        visitor = Character(
            story_id=story.id,
            name="The Visitor (Calder)",
            color_slot=2,
            role="deuteragonist",
            pronouns="she/her",
            personality="Calm in a way that doesn't fit the storm she arrived in.",
        )
        db.add_all([eleanor, visitor])

        lighthouse = Location(story_id=story.id, name="The Lighthouse", location_type="building")
        cottage = Location(story_id=story.id, name="Keeper's Cottage", location_type="building")
        db.add_all([lighthouse, cottage])
        db.flush()

        acts = []
        for i, title in enumerate(["Act One", "Act Two", "Act Three"]):
            act = StructureNode(story_id=story.id, level=0, level_type="act", title=title, position=i)
            db.add(act)
            acts.append(act)
        db.flush()

        scenes = [
            ("The Light", "Eleanor logs the falling glass and sees a boat in the storm.", THE_LIGHT, lighthouse),
            ("Knock at the Door", "The Visitor arrives, soaked and calm, and knows Eleanor's name.", KNOCK, cottage),
            ("The Logbook", "The Visitor asks for the logs, and finds a month cut out.", LOGBOOK, cottage),
        ]
        for i, (title, synopsis, blocks, place) in enumerate(scenes):
            scene = StructureNode(
                story_id=story.id,
                parent_id=acts[0].id,
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
            db.add(SceneSetting(location_id=place.id, node_id=scene.id, role="primary"))
            db.flush()
            derive_heading(scene, story, db)

        recount_story(story.id, db)
        db.commit()
