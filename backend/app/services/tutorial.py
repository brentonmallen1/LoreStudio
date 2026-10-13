"""
The tutorial stories (doc 26, P6): "Learn LoreStudio" (prose) and "Learn Screenplays", taught
by doing. Each account gets both the first time it signs in, and Guides › Start the tutorial
again makes a fresh copy. Its sections (acts, in the script) are topics and its scenes are
lessons: each scene's `metadata_["lesson"]` holds the card shown above it (`text`, and
`practice`: steps of {helper id, task} that tick as the writer tries them), and its text is a
short example to work under. A small cast and two places give the pickers names.

Lesson text is plain, with `code` for what to type and {{key:id}} for a shortcut, as the
guides write them. No AI in any of it but the last prose lesson, which shows in Writer mode too
and says the Assistant needs Studio mode (Brenton, 2026-10-13: an exception to "Writer mode
shows no AI", so the tutorial names everything the app can do).

Which stories an account has is kept in `user.settings["tutorial"]`: format -> story id. The
key being there at all means the account has been given them once, so one it deleted is not
brought back unasked.
"""

from html import escape

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..models import Character, Location, Story, User
from ..models.structure import StructureNode
from .script_scene import derive_heading
from .word_count import recount_story

PROSE = "Learn LoreStudio"
SCRIPT = "Learn Screenplays"
KINDS = ("prose", "screenplay")

CAST = [
    ("Eleanor Vance", ["Eleanor"], "protagonist", "A lighthouse keeper who says no more than she needs to."),
    ("Tom Hale", ["Tom"], "supporting", "Runs the ferry, when there is a ferry. Talks enough for two."),
    ("Margaret Holt", ["Margaret"], "supporting", "Eleanor's oldest friend, and the only one who visits."),
]
PLACES = [
    ("The Lighthouse", "building", "A white tower on the point, its lamp turning all night."),
    ("The Harbor", "landmark", "A stone harbor with one ferry and too many gulls."),
]


def _lesson(text: str, *practice: tuple[str, str]) -> dict:
    return {"text": text, "practice": [{"id": h, "task": t} for h, t in practice]}


def _prose(*paragraphs: str) -> str:
    """Stored as the editor stores prose: the inline syntax (@, [[ ]], <Speaker>) as text."""
    return "".join(f"<p>{escape(p, quote=False)}</p>" for p in paragraphs) + "<p></p>"


def _script(*blocks: tuple[str, str]) -> str:
    return "".join(f'<p data-el="{el}">{escape(t, quote=False)}</p>' for el, t in blocks) + '<p data-el="action"></p>'


#: (section, [(scene title, lesson, content)])
PROSE_LESSONS = [
    (
        "Writing",
        [
            (
                "Start here",
                _lesson(
                    "This story teaches LoreStudio by doing. Each scene is a lesson: read the card, then "
                    "try it in the text below. Everything saves as you type, and {{key:undo}} takes back "
                    "the last thing you did, here or anywhere else in the story. Fold the card away when "
                    "you want the page to yourself. Delete this story when you are done; Guides › Getting "
                    "started makes a fresh copy.",
                    ("slash", "Add something from the menu"),
                ),
                _prose(
                    "The barometer had been falling since noon. @Eleanor Vance noted it in the log and "
                    "went up to the lamp room to watch the sea go still.",
                ),
            ),
            (
                "A quiet page",
                _lesson(
                    "Focus mode ({{key:focusMode}}) hides everything but the words; Esc brings it all "
                    "back. A sprint, from the palette ({{key:palette}}, then Sprint), times you and "
                    "counts what you write. The figures for the scene, the chapter and today are in "
                    "the corner at the bottom right: click the word count.",
                ),
                _prose("She climbed the last of the stairs and stood at the railing while the light came on."),
            ),
        ],
    ),
    (
        "People and places",
        [
            (
                "Naming people",
                _lesson(
                    "Type `@` and choose someone from the Lorebook. The name links to their sheet: hover "
                    "it to see who they are, and the scene counts them as there. A name the Lorebook "
                    "does not have yet is offered as a new character.",
                    ("mention", "Name Tom or Margaret"),
                ),
                _prose("@Eleanor Vance watched the ferry come in. Someone was standing at the rail."),
            ),
            (
                "Naming places",
                _lesson(
                    "Type `[[` and choose a place, or name a new one. The scene then knows where it "
                    "happens, and the place's page lists every scene set there.",
                    ("place", "Send Eleanor somewhere"),
                ),
                _prose("By evening the rain had found its way into [[The Lighthouse]] again."),
            ),
        ],
    ),
    (
        "Dialogue",
        [
            (
                "Giving someone a line",
                _lesson(
                    "Type `^` and choose who speaks. LoreStudio writes the quote marks and remembers who "
                    "said the line, so the Dialogue tool and the checks know. After a quote you typed "
                    "yourself, `<` says who said it; or select words and press {{key:attributeDialogue}}.",
                    ("line", "Give Margaret a line"),
                    ("tag", "Type a quote yourself, then say who said it"),
                    ("attribute", "Make words you select someone's line"),
                ),
                _prose(
                    "The lamp turned above them, and for a moment the whole room went white.",
                    "“Don’t open the door,”<Eleanor Vance> she said.",
                    "“Someone has to.”<Margaret Holt> She reached past her for the latch.",
                ),
            ),
        ],
    ),
    (
        "Notes and to-dos",
        [
            (
                "Notes in the margin",
                _lesson(
                    "A note belongs to the sentence it is about and sits beside it in the margin. Press "
                    "{{key:inlineNote}} or type `/note`; `/todo` makes a to-do to tick off later. The "
                    "Notes page gathers them from the whole story.",
                    ("note", "Leave a note on a sentence"),
                    ("todo", "Leave yourself a to-do"),
                ),
                _prose(
                    "Tom said the ferry would run on Thursday. Eleanor did not believe him, and she was not sure why.",
                ),
            ),
        ],
    ),
    (
        "Shaping the story",
        [
            (
                "Scenes and sections",
                _lesson(
                    "The strip on the left is the story's shape: each stop is a scene. Its + adds a "
                    "scene or a section, and dragging moves one. The Scene sheet (the page icon at the "
                    "top right) holds a scene's purpose, who is in it and where it happens. Plan, in "
                    "the logo menu, walks you through shaping a whole story.",
                ),
                _prose("Write a line or two here, then add a scene after this one from the strip."),
            ),
        ],
    ),
    (
        "Checks",
        [
            (
                "Findings and numbers",
                _lesson(
                    "Findings, in the logo menu, gathers what the checks notice: a name spelled two "
                    "ways, a word used too often, a scene with nobody in it. Nothing is changed until "
                    "you choose. The story in numbers shows lengths, pace and who is on the page.",
                ),
                _prose(
                    "@Eleanor Vance and Elenor walked down to the harbor. The harbor was quiet. The "
                    "harbor was always quiet in the evening.",
                ),
            ),
        ],
    ),
    (
        "The Assistant",
        [
            (
                "Asking about your story",
                # The one lesson about AI, in Writer mode too (Brenton, 2026-10-13): it says the
                # Assistant needs Studio mode, since Writer mode shows none of its buttons.
                _lesson(
                    "This lesson needs Studio mode: switch at the bottom of the logo menu, or in "
                    "Settings › Appearance › Mode. Writer mode keeps to your story and hides the "
                    "Assistant and its buttons. In Studio mode, the Assistant answers questions about "
                    "your story and points things out; it never writes your prose. Open it from the "
                    "feather on the right, or with {{key:assistant}}. It needs a model, set up in "
                    "Settings › AI / LLM.",
                ),
                _prose("Ask the Assistant who has not appeared since the harbor, then come back here."),
            ),
        ],
    ),
]

SCRIPT_LESSONS = [
    (
        "Elements",
        [
            (
                "Enter and Tab",
                _lesson(
                    "A script is made of elements: scene headings, action, a character's name, "
                    "parentheticals, dialogue and transitions. At the end of a line, Enter starts the "
                    "element that usually comes next. Tab turns the line you are on into the next "
                    "element, and Shift-Tab goes back. {{key:scriptHeading}} to {{key:scriptTransition}} "
                    "choose one directly.",
                    ("script-enter", "Start the next element"),
                    ("script-tab", "Turn a line into another element"),
                    ("script-keys", "Choose an element directly"),
                ),
                _script(
                    ("heading", "INT. LIGHTHOUSE, LAMP ROOM - DUSK"),
                    ("action", "Eleanor writes in the logbook. The glass is falling."),
                ),
            ),
        ],
    ),
    (
        "Scenes",
        [
            (
                "Scene headings",
                _lesson(
                    "At the start of a line, `INT. ` or `EXT. ` makes it a scene heading, and the place "
                    "after it is offered from the Lorebook. A heading typed partway down a scene offers "
                    "to start a new scene there: press Enter at its end and you are in it.",
                    ("script-heading", "Start a scene heading"),
                    ("smart-type", "Let SmartType finish a place or a time of day"),
                ),
                _script(
                    ("heading", "INT. KEEPER'S COTTAGE - NIGHT"),
                    ("action", "Rain on the window. A knock at the door."),
                ),
            ),
        ],
    ),
    (
        "Who speaks",
        [
            (
                "Names and speeches",
                _lesson(
                    "On a character line, start a name and Tab finishes it from the Lorebook. An empty "
                    "line of speech takes `(` for a parenthetical. `^` works here too: choose who "
                    "speaks and type the line.",
                    ("script-cue", "Start a name and let the Lorebook finish it"),
                    ("script-paren", "Give an actor a direction"),
                    ("line", "Give Tom a line"),
                ),
                _script(
                    ("heading", "EXT. THE HARBOR - DAY"),
                    ("action", "Tom ties up the ferry. Eleanor watches from the wall."),
                    ("cue", "TOM"),
                    ("dialogue", "Thursday. It'll run Thursday."),
                ),
            ),
        ],
    ),
    (
        "Typing less",
        [
            (
                "The slash menu and pasting",
                _lesson(
                    "Type `/` for every element by name: `/heading`, `/character`, `/transition`. A "
                    "script pasted in, Fountain or plain text, comes in with each line as its element.",
                    ("slash", "Choose an element from the menu"),
                    ("fountain-paste", "Paste in a few lines of a script"),
                ),
                _script(
                    ("heading", "INT. LIGHTHOUSE, STAIRS - NIGHT"),
                    ("action", "Eleanor climbs. Somewhere below, the door bangs in the wind."),
                ),
            ),
        ],
    ),
    (
        "The page",
        [
            (
                "Pages and export",
                _lesson(
                    "The corner at the bottom right shows the scene's length in pages, counted as the "
                    "printed page sets them. The running time assumes a minute a page, and says so "
                    "wherever it is shown. Export, in the ⋯ menu, writes a PDF, Final Draft or Fountain "
                    "with the standard margins.",
                ),
                _script(
                    ("heading", "EXT. THE POINT - DAWN"),
                    ("action", "The storm has passed. The lamp turns once more, then goes out."),
                    ("transition", "FADE OUT."),
                ),
            ),
        ],
    ),
]


def _cast(db: Session, story: Story) -> None:
    for slot, (name, aliases, role, personality) in enumerate(CAST, start=1):
        db.add(
            Character(
                story_id=story.id,
                name=name,
                aliases=aliases,
                role=role,
                color_slot=slot,
                personality=personality,
            )
        )
    for slot, (name, kind, description) in enumerate(PLACES, start=len(CAST) + 1):
        db.add(Location(story_id=story.id, name=name, location_type=kind, color_slot=slot, description=description))


def make(db: Session, user: User, kind: str) -> Story:
    """A fresh copy of one tutorial story in this account; flushed, not committed."""
    script = kind == "screenplay"
    story = Story(
        user_id=user.id,
        title=SCRIPT if script else PROSE,
        story_format="screenplay" if script else "prose",
        structure_template_id="screenplay" if script else "freeform",
        description=(
            "Learn to write a screenplay in LoreStudio, a lesson a scene."
            if script
            else "Learn LoreStudio by doing, a lesson a scene."
        ),
        genre="Tutorial",
        narrative_intent="A lesson a scene: read the card above the text, then try it below.",
        author_name="",
    )
    db.add(story)
    db.flush()
    _cast(db, story)
    db.flush()
    lessons = SCRIPT_LESSONS if script else PROSE_LESSONS
    total = sum(len(scenes) for _, scenes in lessons)
    number = 0
    for i, (topic, scenes) in enumerate(lessons):
        section = StructureNode(
            story_id=story.id,
            level=0,
            level_type="act" if script else "section",
            title=f"{i + 1}. {topic}",
            position=i,
        )
        db.add(section)
        db.flush()
        for j, (title, lesson, content) in enumerate(scenes):
            number += 1
            scene = StructureNode(
                story_id=story.id,
                parent_id=section.id,
                level=1,
                level_type="scene",
                title=title,
                position=j,
                status="draft",
                content=content,
                metadata_={"lesson": {**lesson, "number": number, "of": total, "topic": topic}},
            )
            db.add(scene)
            db.flush()
            derive_heading(scene, story, db)
    db.flush()
    recount_story(story.id, db)
    return story


def _remember(user: User, kind: str, story_id: str) -> None:
    kept = dict((user.settings or {}).get("tutorial") or {})
    kept[kind] = story_id
    user.settings = {**(user.settings or {}), "tutorial": kept}
    flag_modified(user, "settings")


def has_own_stories(db: Session, user: User) -> bool:
    """A story the writer made: not a sample, and not a tutorial."""
    from .examples import SAMPLE_TITLES  # examples imports the seeds, which are heavy

    given = {PROSE, SCRIPT, *SAMPLE_TITLES}
    return any(title not in given for (title,) in db.query(Story.title).filter(Story.user_id == user.id))


def ensure(db: Session, user: User) -> list[str]:
    """Both stories, the first time this account asks; the titles made (none after that). An
    account that already has stories of its own (one from before the tutorial, signing in after
    an update) is only marked as asked: it is not handed lessons it never wanted, and Guides ›
    Getting started makes them on request (Brenton, 2026-10-13)."""
    if "tutorial" in (user.settings or {}):
        return []
    made = []
    user.settings = {**(user.settings or {}), "tutorial": {}}
    flag_modified(user, "settings")
    if has_own_stories(db, user):
        db.commit()
        return []
    for kind in KINDS:
        story = make(db, user, kind)
        _remember(user, kind, story.id)
        made.append(story.title)
    db.commit()
    return made


def restart(db: Session, user: User, kind: str) -> Story:
    """A fresh copy of one tutorial story (Guides › Start the tutorial again). The copy the
    writer has stays: what they wrote in it is theirs to delete."""
    story = make(db, user, kind)
    _remember(user, kind, story.id)
    db.commit()
    return story
