"""The Lighthouse Years demo shows what a series does, and seeds once."""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.series import Series
from app.models.story import Story
from app.models.structure import StructureNode
from app.services import seed, seed_series
from app.services.findings import collect
from app.services.proposals import gather
from app.services.proposals.sources import scene_titles
from app.services.series import service


def _seed(db_session: Session, monkeypatch) -> tuple[Story, Story]:
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    monkeypatch.setattr(seed_series, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    seed_series.seed_lighthouse_sequel()
    seed_series.seed_lighthouse_sequel()
    one = db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()
    two = db_session.query(Story).filter(Story.title == seed_series.SEQUEL).one()
    return one, two


def test_the_sequel_is_book_two_and_carries_eleanor_on(db_session: Session, monkeypatch):
    one, two = _seed(db_session, monkeypatch)
    [series] = db_session.query(Series).all()
    assert series.name == "The Lighthouse Years"
    assert {sid: p for sid, p in service.positions(series).items() if p < 2} == {one.id: 0, two.id: 1}
    assert two.structure_template_id == one.structure_template_id and two.genre == one.genre
    words = sum(n.word_count or 0 for n in db_session.query(StructureNode).filter(StructureNode.story_id == two.id))
    assert words > 50, "its scenes are counted, so the dashboard does not call it not started"

    names = {c.name for c in db_session.query(Character).filter(Character.story_id == two.id)}
    assert names == {"Eleanor Vance", "Thomas Vance"}
    hers = db_session.query(Character).filter(Character.story_id == two.id, Character.name == "Eleanor Vance").one()
    assert (
        hers.personality
        != db_session.query(Character)
        .filter(Character.story_id == one.id, Character.name == "Eleanor Vance")
        .one()
        .personality
    )


def test_it_shows_a_disagreement_and_a_proposal(db_session: Session, monkeypatch):
    one, two = _seed(db_session, monkeypatch)
    for story in (one, two):
        canon = [f for f in collect(story, db_session).findings if f.check == "series-canon"]
        assert [f.fix.field for f in canon if f.fix] == ["background"], story.title

    proposals = [p for p in gather(two.id, db_session) if p.id.startswith("series-")]
    assert [p.subject for p in proposals] == ["Margaret Holt"]
    assert set(proposals[0].where.split(", ")) <= set(scene_titles(two.id, db_session).values())


def test_its_promises_run_across_the_books(db_session: Session, monkeypatch):
    from app.models.compendium import CompendiumEntry
    from app.models.diagram import Diagram
    from app.models.plot_thread import PlotThread
    from app.services.promises import promises_view

    one, two = _seed(db_session, monkeypatch)
    first, second = promises_view(one.id, db_session), promises_view(two.id, db_session)

    staying_one = next(t for t in first.threads if t.name == seed_series.STAYING)
    staying_two = next(t for t in second.threads if t.name == seed_series.STAYING)
    assert first.across[staying_one.id].continues_in == 1
    assert second.across[staying_two.id].from_book == 0
    sent = next(t for t in first.twists if t.name == seed_series.SENT)
    assert first.across[sent.id].revealed_in.title == "The Letter"

    # Book 1 led the reader to believe Margaret wants her to stay; the letter overturns it.
    believes = second.coming_in.believes
    assert "Margaret wants Eleanor to stay on the island." in [b.text for b in believes]
    assert {b.overturned_at for b in believes} == {"The Letter"}
    [link] = second.series_setups
    assert (link.direction, link.other.title) == ("in", "The New Entry")

    quiet = {"misdirection_unanswered", "reveal_without_clue", "series-left-open"}
    for story in (one, two):
        assert not quiet & {f.check for f in collect(story, db_session).findings}, story.title

    for model, title in ((CompendiumEntry, "Keeping a light: the log"), (Diagram, "Harrow Island")):
        assert {one.id, two.id} < {r.story_id for r in db_session.query(model).filter(model.title == title)}

    offered = {c["name"]: c["preselect"] for c in service.carry_candidates(db_session, two)}
    assert offered[seed_series.STAYING] is True, "still open: Book 3 would carry it"
    assert seed_series.SENT not in offered, "revealed"
    assert db_session.query(PlotThread).filter(PlotThread.name == seed_series.STAYING).count() == 3, "Book 3 too"


def test_it_shows_a_series_planned_ahead(db_session: Session, monkeypatch):
    one, two = _seed(db_session, monkeypatch)
    [series] = db_session.query(Series).all()
    books = sorted(series.books, key=lambda b: b.position)
    assert [b.story.title for b in books] == [one.title, two.title, seed_series.BOOK_THREE]
    assert all(b.role for b in books) and [len(b.arc_beats) for b in books] == [1, 1, 1]
    assert [a["label"] for a in series.axes] == ["Viewpoint", "Era"]
    three = books[2].story
    assert not any((n.word_count or 0) for n in three.structure_nodes), "Book 3 is planned, not written"

    # Book 3 is seen through Margaret, who is not in it yet; its era is still an idea.
    missing = [f for f in collect(three, db_session).findings if f.check == "series-axis-missing"]
    assert [f.where for f in missing] == ["Margaret Holt"]
    era = series.axes[1]["id"]
    assert books[2].slots[era] == {"element_id": None, "text": "After the light goes dark"}

    # Book 2's flashback is told by Thomas: read last, it happens first.
    pov = [f for f in collect(two, db_session).findings if f.check == "series-axis-pov"]
    assert [f.where for f in pov] == ["The Storm of '62"]
    assert not [f for f in collect(one, db_session).findings if f.check.startswith("series-axis")]
    storm = db_session.query(StructureNode).filter(StructureNode.title == "The Storm of '62").one()
    assert (storm.in_world_date, storm.timeline_position) == ("November 1962", 1)
