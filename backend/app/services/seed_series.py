"""The Lighthouse Years: The Last Lighthouse and its sequel, to show what a series does.

Seeded with the extra demos (``SEED_EXTRA_DEMOS``), after The Last Lighthouse, so a first
run stays one book. It shows, in order of discovery:

- the dashboard's series group and the app bar's series name;
- Eleanor carried over and changed: in the sequel she wants something else, and the Canon
  and her sheet show it book by book;
- a disagreement, the kind a sequel makes by accident: book one says she left for the
  mainland at nineteen, the sequel says seventeen. A finding in both books;
- Margaret Holt shared by the series but not carried over, named in the sequel's prose: a
  "From the series" row, and a proposal to bring her in.

And its promises across the books (v1.5):

- a thread, "Staying or Leaving", that Book 1 opens and leaves open and Book 2 carries on, so
  starting Book 3 offers it ticked;
- a twist planted in Book 1 and revealed in Book 2: Margaret sent for the survey. Book 1
  leads the reader to believe she wants Eleanor to stay; Book 2's Coming in strikes that out
  where the letter reveals her hand, and so does The story so far;
- a setup across books: Book 2's first log entry calls back to Book 1's last;
- research the series shares, kept in step: a note on keepers' logs and a map of the island.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import settings
from ..database import engine
from ..models.character import Character
from ..models.compendium import CompendiumEntry
from ..models.diagram import Diagram
from ..models.location import Location
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.story import Story
from ..models.structure import StoryStructureTemplate, StructureNode
from ..models.twist import Twist, TwistClue
from ..models.user import User
from .series import service, setups, sync
from .structure_scaffold import scaffold_story
from .word_count import recount_story

SEQUEL = "The Keeper's Daughter"

CARRIED_CHARACTERS = ("Eleanor Vance", "Thomas Vance")
CARRIED_PLACES = ("Harrow Island", "The Lighthouse", "Keeper's Cottage", "The Village")

ELEANOR_NOW = {
    "mission_statement": "To keep the light without keeping its secrets, and find out whether the island can be a home rather than a vigil.",
    "personality": "Still economical with words, but less guarded: she asks questions now and waits for the answers. Laughs more than she expects to.",
    "motivation": "The truth about the Ardent is out. What is left is whether she stays because she chooses to.",
    "arc_notes": "From keeping a promise she never made toward making one of her own: to the island, or to leaving it.",
    "epiphany": "",
    # The slip a sequel makes: book one says nineteen.
    "background": "Grew up on Harrow Island, the daughter of the lighthouse keeper. Left for the mainland at seventeen, built a career as a cartographer, but returned when her father fell ill. He died two months after her arrival. She never left.",
}

SCENES = (
    (
        "One Year On",
        "Eleanor keeps the log as she always has, and finds she has started writing to someone.",
        "<p>A year to the day after the storm, Eleanor wrote the date at the top of the log and then, "
        "without meaning to, a second line: <em>Calm. Visibility good. I miss the noise of you asking "
        "questions.</em></p><p>She looked at it a long time. Then she left it there.</p>"
        "<p>From the cottage window she could see Margaret's kitchen light across the harbour, on "
        "early as ever.</p>",
    ),
    (
        "The Letter",
        "A letter from the mainland asks Eleanor to survey the coast. Leaving would mean the light goes dark.",
        "<p>The envelope had a government crest and her name spelled right, which was how she knew it "
        "was serious.</p><p>“They want a chart of the whole coast,” she told the lamp. “Six weeks on "
        "the mainland.” The lamp, as ever, had no opinion.</p><p>Folded inside was a covering note, "
        "and the hand was one she knew: Margaret's. <em>They asked who could do it. I told them.</em></p>",
    ),
)


def _fill_scenes(db: Session, sequel: Story) -> None:
    template = db.get(StoryStructureTemplate, sequel.structure_template_id)
    first = scaffold_story(sequel.id, template, db)
    if first is None:
        return
    title, synopsis, content = SCENES[0]
    first.title, first.synopsis, first.content = title, synopsis, content
    for i, (title, synopsis, content) in enumerate(SCENES[1:], start=1):
        db.add(
            StructureNode(
                story_id=sequel.id,
                parent_id=first.parent_id,
                title=title,
                synopsis=synopsis,
                content=content,
                level=first.level,
                level_type=first.level_type,
                position=first.position + i,
            )
        )
    db.flush()


STAYING = "Staying or Leaving"
SENT = "Margaret Sent for the Survey"


def _scene(db: Session, story: Story, title: str) -> StructureNode | None:
    return db.query(StructureNode).filter(StructureNode.story_id == story.id, StructureNode.title == title).first()


def _book_one_promises(db: Session, book_one: Story) -> list[dict]:
    """A thread Book 1 leaves open and a twist it plants, for the sequel to carry."""
    visit, entry = _scene(db, book_one, "Margaret's Visit"), _scene(db, book_one, "The New Entry")
    if visit is None or entry is None:
        return []
    staying = PlotThread(
        story_id=book_one.id,
        name=STAYING,
        description="Does Eleanor keep the light because she chooses to, or because no one else will?",
        color_slot=3,
        mice_type="character",
    )
    sent = Twist(
        story_id=book_one.id,
        name=SENT,
        twist_type="reveal",
        color_slot=6,
        the_truth="Margaret asked the ministry to offer Eleanor the survey: she wants her free of the light.",
        the_misdirection="Margaret wants Eleanor to stay on the island.",
    )
    db.add_all([staying, sent])
    db.flush()
    db.add(
        PlotThreadAppearance(
            thread_id=staying.id, node_id=entry.id, role="opens", note="She writes the date, and stays."
        )
    )
    db.add_all(
        [
            TwistClue(
                twist_id=sent.id,
                node_id=visit.id,
                points_to="truth",
                text="Margaret asks, too casually, whether Eleanor still has her survey instruments.",
                position=0,
            ),
            TwistClue(
                twist_id=sent.id,
                node_id=visit.id,
                points_to="misdirection",
                text="Margaret says the island would not know itself without a Vance at the light.",
                position=1,
            ),
            ReaderKnowledgeEvent(
                story_id=book_one.id,
                node_id=visit.id,
                twist_id=sent.id,
                knowledge_type="misdirection_planted",
                subject="Margaret wants Eleanor to stay on the island.",
                reader_knows=True,
                is_truth=False,
            ),
        ]
    )
    db.flush()
    return [{"kind": "plot_thread", "ref_id": staying.id}, {"kind": "twist", "ref_id": sent.id}]


def _book_two_promises(db: Session, series, book_one: Story, sequel: Story) -> None:
    """The sequel moves the thread on, reveals the twist, and calls back to Book 1's last log."""
    letter, year = _scene(db, sequel, "The Letter"), _scene(db, sequel, "One Year On")
    entry = _scene(db, book_one, "The New Entry")
    staying = db.query(PlotThread).filter(PlotThread.story_id == sequel.id, PlotThread.name == STAYING).first()
    sent = db.query(Twist).filter(Twist.story_id == sequel.id, Twist.name == SENT).first()
    if letter is None or year is None:
        return
    if staying is not None:
        db.add(PlotThreadAppearance(thread_id=staying.id, node_id=letter.id, role="complicates"))
    if sent is not None:
        sent.revealed_at_node_id = letter.id
    if entry is not None:
        setups.add_link(
            db,
            series,
            (book_one.id, entry.id),
            (sequel.id, year.id),
            link_type="callback",
            note="The log again: this time she writes to someone.",
            made_in=sequel.id,
            actor_id=None,
            client_id=None,
            log=False,
        )


def _shared_research(db: Session, series, book_one: Story) -> None:
    """A note and a map every book of the series has, kept in step."""
    note = CompendiumEntry(
        story_id=book_one.id,
        title="Keeping a light: the log",
        entry_type="note",
        content="<p>Keepers logged the weather, the visibility and every vessel sighted: hourly in a storm. "
        "A gap in a log was a matter for the Board, which is why Thomas's gap was a secret.</p>",
        tags=["lighthouse", "research"],
        category="history",
    )
    island = Diagram(
        story_id=book_one.id,
        title="Harrow Island",
        description="Where everything is, for every book.",
        nodes=[
            {"id": "light", "type": "central", "position": {"x": 0, "y": 0}, "data": {"label": "The Lighthouse"}},
            {
                "id": "cottage",
                "type": "mindmap",
                "position": {"x": 220, "y": -80},
                "data": {"label": "Keeper's Cottage"},
            },
            {"id": "village", "type": "mindmap", "position": {"x": 220, "y": 80}, "data": {"label": "The Village"}},
            {"id": "harbour", "type": "mindmap", "position": {"x": 440, "y": 80}, "data": {"label": "The Harbour"}},
        ],
        edges=[
            {"id": "e1", "source": "light", "target": "cottage"},
            {"id": "e2", "source": "light", "target": "village"},
            {"id": "e3", "source": "village", "target": "harbour"},
        ],
    )
    db.add_all([note, island])
    db.flush()
    for kind, row in (("compendium_entry", note), ("diagram", island)):
        sync.share(db, series, kind, book_one.id, row.id, actor_id=None, client_id=None, log=False)


def seed_lighthouse_sequel() -> None:
    with Session(engine) as db:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if not admin:
            return
        book_one = db.query(Story).filter(Story.user_id == admin.id, Story.title == "The Last Lighthouse").first()
        if book_one is None or db.query(Story).filter(Story.user_id == admin.id, Story.title == SEQUEL).first():
            return
        if service.membership(db, book_one.id) is not None:
            return

        chars = {c.name: c for c in db.query(Character).filter(Character.story_id == book_one.id)}
        places = {p.name: p for p in db.query(Location).filter(Location.story_id == book_one.id)}
        carry = [{"kind": "character", "ref_id": chars[n].id} for n in CARRIED_CHARACTERS if n in chars]
        carry += [{"kind": "location", "ref_id": places[n].id} for n in CARRIED_PLACES if n in places]
        carry += _book_one_promises(db, book_one)

        sequel = Story(
            user_id=admin.id,
            title=SEQUEL,
            description="A year after the storm, Eleanor is offered a way off the island.",
            logline="A year after the truth about the Ardent came out, a lighthouse keeper is offered the mainland, and has to decide whether staying was ever her choice.",
            premise="With her father's secret told, Eleanor keeps the light because she wants to, or so she thinks, until a letter offers her the coast she used to chart.",
        )
        db.add(sequel)
        db.flush()
        series = service.start_next_book(db, book_one, sequel, carry, series_name="The Lighthouse Years")
        series.premise = "A lighthouse on Harrow Island, and what keeping it costs the people who do."
        series.intent = (
            "Each book asks the keeper the same question from further off: is staying a promise, a habit or a choice?"
        )

        # Shared by the series, not carried over: the sequel names her, and does not have her yet.
        if "Margaret Holt" in chars:
            service.lift_element(db, series, "character", book_one.id, chars["Margaret Holt"].id)

        eleanor = (
            service.element_for_row(db, "characters", chars["Eleanor Vance"].id) if "Eleanor Vance" in chars else None
        )
        mine = service.member_in(eleanor, sequel.id) if eleanor else None
        row = service.member_row(db, mine) if mine else None
        if row is not None:
            for key, value in ELEANOR_NOW.items():
                setattr(row, key, value)

        _fill_scenes(db, sequel)
        _book_two_promises(db, series, book_one, sequel)
        _shared_research(db, series, book_one)
        recount_story(sequel.id, db)
        db.commit()
