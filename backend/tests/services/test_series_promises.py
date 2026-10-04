"""Promises across the books of a series: each book read with its neighbours (v1.5)."""

from sqlalchemy.orm import Session

from app.models.plot_thread import PlotThreadAppearance
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.twist import TwistClue
from app.services.promises import promises_view
from app.services.series import service
from app.services.series.promises import SeriesPromises, earlier_for_assistant
from tests.fixtures.series_factory import empty_book, scenes, thread, twist


def _books(db: Session, user, n: int):
    books = [empty_book(db, user, f"Book {i + 1}") for i in range(n)]
    series = service.create_series(db, user.id, "The Lighthouse Years")
    for b in books:
        service.attach_story(db, series, b)
    return series, books


def _carry(db, series, kind: str, row, *into):
    """Share ``row`` and bring it into each of ``into``; returns the copies."""
    element = service.lift_element(db, series, kind, row.story_id, row.id)
    return [service.adopt_into_book(db, series, element, b.id, actor_id=None, client_id=None, log=False) for b in into]


def _checks(db, story_id: str) -> set[str]:
    return {c.check for c in promises_view(story_id, db).checks}


def test_a_twist_clued_in_book_one_and_revealed_in_book_three(db_session: Session, test_user):
    series, (one, two, three) = _books(db_session, test_user, 3)
    [a1, a2] = scenes(db_session, one, "The Light", "Margaret's Visit")
    [b1] = scenes(db_session, two, "One Year On")
    [c1, c2] = scenes(db_session, three, "The Return", "The Truth")
    sent = twist(
        db_session,
        one,
        "Margaret Sent the Letter",
        (a1, "truth", "She knows the survey office by name."),
        (a2, "misdirection", "She wants Eleanor to stay."),
        truth="Margaret asked the ministry to offer Eleanor the survey.",
    )
    copy2, copy3 = _carry(db_session, series, "twist", sent, two, three)
    copy3.revealed_at_node_id = c2.id
    db_session.commit()

    assert "misdirection_unanswered" not in _checks(db_session, one.id), "answered in Book 3"
    assert "reveal_without_clue" not in _checks(db_session, three.id), "Book 1 clued it"

    view = promises_view(three.id, db_session)
    assert view.book == 2 and view.series_id == series.id
    believes = view.coming_in.believes
    assert [(i.text, i.book, i.overturned_at) for i in believes] == [("She wants Eleanor to stay.", 0, "The Truth")], (
        "a belief from Book 1, overturned by this book's reveal"
    )
    assert believes[0].twist_id == copy3.id
    reveal_row = next(r for r in view.reader if r.node_id == c2.id)
    assert [(i.text, i.over) for i in reveal_row.believes] == [("She wants Eleanor to stay.", True)]

    one_view = promises_view(one.id, db_session)
    across = one_view.across[sent.id]
    assert across.revealed_in.position == 2 and across.revealed_in.title == "The Truth"
    assert across.continues_in == 1
    assert [s.position for s in across.books] == [0, 1, 2]
    assert across.books[0].toward == 1 and across.books[0].away == 1 and across.books[2].reveal == "The Truth"
    assert promises_view(two.id, db_session).across[copy2.id].from_book == 0


def test_a_clue_after_an_earlier_book_revealed_it(db_session: Session, test_user):
    series, (one, two) = _books(db_session, test_user, 2)
    [a1] = scenes(db_session, one, "The Gap")
    [b1] = scenes(db_session, two, "Echo")
    told = twist(db_session, one, "The Visitor", (a1, "truth", "She knows the way."), truth="She was here before.")
    told.revealed_at_node_id = a1.id
    [copy] = _carry(db_session, series, "twist", told, two)
    db_session.add(TwistClue(twist_id=copy.id, node_id=b1.id, points_to="truth", text="Again, the way."))
    db_session.commit()
    [check] = [c for c in promises_view(two.id, db_session).checks if c.check == "clue_after_reveal"]
    assert check.text == "A clue for The Visitor comes in Echo, after Book 1 revealed it"


def test_threads_carried_on_and_what_the_earlier_books_left_open(db_session: Session, test_user):
    series, (one, two, three) = _books(db_session, test_user, 3)
    [a1, a2] = scenes(db_session, one, "Margaret's Visit", "The New Entry")
    [b1] = scenes(db_session, two, "The Letter")
    scenes(db_session, three, "The Return")
    silence = thread(db_session, one, "Margaret's Silence", (a1, "opens"), (a2, "turns"))
    [copy2] = _carry(db_session, series, "plot_thread", silence, two)
    db_session.add(PlotThreadAppearance(thread_id=copy2.id, node_id=b1.id, role="moves"))
    db_session.commit()

    one_view = promises_view(one.id, db_session)
    assert one_view.across[silence.id].continues_in == 1
    two_view = promises_view(two.id, db_session)
    assert two_view.across[copy2.id].from_book == 0
    [still] = promises_view(three.id, db_session).open_from_earlier
    assert (still.name, still.opened_book, still.last_book, still.last) == ("Margaret's Silence", 0, 1, "moves it on")
    assert still.ref_id is None, "Book 3 does not have it"


def test_left_open_opens_again_and_crossing_across_books(db_session: Session, test_user):
    series, (one, two) = _books(db_session, test_user, 2)
    [a1, a2, a3] = scenes(db_session, one, "One", "Two", "Three")
    [b1, b2, b3] = scenes(db_session, two, "Four", "Five", "Six")
    # A book's own thread, still open at its end: nothing later picks it up.
    thread(db_session, one, "The Ardent's Signal", (a1, "opens"))
    # Shared threads that cross: the keeper's opens first, the island's inside it, but closes after.
    keeper = thread(db_session, one, "The Keeper", (a1, "opens"), mice_type="character")
    island = thread(db_session, one, "The Island", (a2, "opens"), mice_type="character")
    [k2] = _carry(db_session, series, "plot_thread", keeper, two)
    [i2] = _carry(db_session, series, "plot_thread", island, two)
    db_session.add_all(
        [
            PlotThreadAppearance(thread_id=k2.id, node_id=b1.id, role="closes"),
            PlotThreadAppearance(thread_id=i2.id, node_id=b2.id, role="opens"),
            PlotThreadAppearance(thread_id=i2.id, node_id=b3.id, role="closes"),
        ]
    )
    db_session.commit()

    sp = SeriesPromises(db_session, series)
    found = {(c.check, c.story_id, c.where) for c in sp.checks()}
    assert ("series-left-open", one.id, "The Ardent's Signal") in found
    assert not any(c == "series-left-open" and w != "The Ardent's Signal" for c, _, w in found), "carried on"
    assert ("series-opens-again", two.id, "The Island") in found
    nesting = {(sid, w) for c, sid, w in found if c == "series-nesting"}
    assert nesting == {(one.id, "The Island"), (two.id, "The Island")}
    left = next(c for c in sp.checks() if c.check == "series-left-open")
    assert left.element_id is None and left.carry_to == two.id, "a book's own thread is not the series'"


def test_carry_over_ticks_what_is_still_open(db_session: Session, test_user):
    series, (one,) = _books(db_session, test_user, 1)
    [a1, a2] = scenes(db_session, one, "One", "Two")
    thread(db_session, one, "Open", (a1, "opens"))
    thread(db_session, one, "Closed", (a1, "opens"), (a2, "closes"))
    thread(db_session, one, "Planned")
    twist(db_session, one, "Seeded", (a1, "truth", "A hint."))
    twist(db_session, one, "Told", (a1, "truth", "A hint."), reveal=a2)
    db_session.commit()
    got = {
        c["name"]: c["preselect"]
        for c in service.carry_candidates(db_session, one)
        if c["kind"] in ("plot_thread", "twist")
    }
    assert got == {"Open": True, "Planned": False, "Seeded": True}


def test_the_assistant_hears_of_earlier_books_only(db_session: Session, test_user):
    series, (one, two, three) = _books(db_session, test_user, 3)
    [a1] = scenes(db_session, one, "One")
    scenes(db_session, two, "Two")
    [c1] = scenes(db_session, three, "Three")
    # Shared with the series (a book's own thread left behind is a finding, not the Assistant's).
    _carry(db_session, series, "plot_thread", thread(db_session, one, "Margaret's Silence", (a1, "opens")))
    thread(db_session, three, "A Book Three Secret", (c1, "opens"))
    told = twist(db_session, one, "The Letter", (a1, "misdirection", "It is from the ministry."), truth="Margaret.")
    _carry(db_session, series, "twist", told, three)
    db_session.add(
        ReaderKnowledgeEvent(
            story_id=one.id,
            node_id=a1.id,
            knowledge_type="reader_only",
            subject="The lamp is failing.",
            reader_knows=True,
        )
    )
    db_session.commit()

    assert earlier_for_assistant(db_session, one.id) == {}
    told_two = earlier_for_assistant(db_session, two.id)
    assert [t["name"] for t in told_two["open_threads"]] == ["Margaret's Silence"]
    assert told_two["unrevealed_twists"][0]["truth"] == "Margaret."
    assert told_two["reader_believes"] == ["Book 1: It is from the ministry."]
    assert told_two["only_the_reader_knows"] == ["Book 1: The lamp is failing."]
    assert "A Book Three Secret" not in str(told_two)


def test_a_scene_s_context_says_what_the_earlier_books_left_open(db_session: Session, test_user):
    from app.services.codex.context import assemble_scene
    from app.services.llm.prompts.chat import build_scene_chat_system_prompt

    series, (one, two) = _books(db_session, test_user, 2)
    [a1] = scenes(db_session, one, "Margaret's Visit")
    [b1] = scenes(db_session, two, "The Letter")
    _carry(db_session, series, "plot_thread", thread(db_session, one, "Margaret's Silence", (a1, "opens")))
    db_session.commit()

    assembled = assemble_scene(two, b1, db_session)
    assert assembled.packet["earlier_books"] == [
        "Still open: Margaret's Silence (since Book 1; last, Book 1: opens it)"
    ]
    block = next(b for b in assembled.blocks if b.key == "earlier_books")
    assert block.included and block.label == "From earlier books (1)"
    assert "## From the earlier books of this series" in build_scene_chat_system_prompt(assembled.packet)
    assert assemble_scene(one, a1, db_session).packet["earlier_books"] == []
