"""Series service: books in order, elements copied from where they last stood."""

import pytest

from app.models import Character, CharacterRelationship, HistoricalEvent, Location, Series, SeriesElement, Story
from app.services import change_log
from app.services.series import service
from tests.fixtures.series_factory import empty_book, make_book


def _series(db, user, *stories):
    series = service.create_series(db, user.id, "The Lighthouse Years")
    for s in stories:
        service.attach_story(db, series, s)
    return series


def _adopt(db, series, element, story):
    return service.adopt_into_book(db, series, element, story.id, actor_id=None, client_id=None)


def test_books_keep_their_order_and_one_series_each(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "The Keeper's Daughter")
    series = _series(db_session, test_user, one.story, two)
    assert service.positions(series) == {one.story.id: 0, two.id: 1}

    service.reorder(db_session, series, [two.id, one.story.id])
    assert service.positions(series) == {two.id: 0, one.story.id: 1}
    with pytest.raises(service.SeriesError):
        service.reorder(db_session, series, [two.id])

    other = service.create_series(db_session, test_user.id, "Another")
    with pytest.raises(service.SeriesError) as e:
        service.attach_story(db_session, other, two)
    assert e.value.status_code == 409
    assert service.attach_story(db_session, series, two).series_id == series.id


def test_a_series_needs_a_name(db_session, test_user):
    with pytest.raises(service.SeriesError):
        service.create_series(db_session, test_user.id, "   ")


def test_adopting_copies_where_the_element_last_stood(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    element = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    assert service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id) is element

    copy = _adopt(db_session, series, element, two)

    assert copy.id != one.eleanor.id and copy.story_id == two.id
    assert copy.name == "Eleanor"
    assert copy.background == one.eleanor.background
    assert copy.personality == one.eleanor.personality
    assert copy.aliases == ["Nell"]
    assert copy.arc_milestones == [], "milestones name the scenes of the book they were made in"
    assert {m.story_id for m in element.members} == {one.story.id, two.id}
    with pytest.raises(service.SeriesError):
        _adopt(db_session, series, element, two)


def test_a_book_starts_from_the_nearest_earlier_book_and_a_prequel_from_the_next(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    three = empty_book(db_session, test_user, "Book Three")
    series = _series(db_session, test_user, one.story, two, three)
    element = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    in_two = _adopt(db_session, series, element, two)
    in_two.personality = "Opening up."
    db_session.flush()

    assert _adopt(db_session, series, element, three).personality == "Opening up."

    prequel = empty_book(db_session, test_user, "Before the Light")
    service.attach_story(db_session, series, prequel, 0)
    assert service.positions(series)[prequel.id] == 0
    assert _adopt(db_session, series, element, prequel).personality == "Guarded."


def test_relationships_come_over_only_when_both_ends_do(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    eleanor = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    visitor = service.lift_element(db_session, series, "character", one.story.id, one.visitor.id)

    el2 = _adopt(db_session, series, eleanor, two)
    assert db_session.query(CharacterRelationship).filter(CharacterRelationship.character_id == el2.id).count() == 0

    vis2 = _adopt(db_session, series, visitor, two)
    rel = (
        db_session.query(CharacterRelationship)
        .filter(CharacterRelationship.character_id == el2.id, CharacterRelationship.related_character_id == vis2.id)
        .one()
    )
    assert rel.relationship_type == "stranger" and rel.description == "She does not trust him yet."


def test_a_place_keeps_its_parent_when_the_parent_came_too(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    three = empty_book(db_session, test_user, "Book Three")
    series = _series(db_session, test_user, one.story, two, three)
    coast = service.lift_element(db_session, series, "location", one.story.id, one.coast.id)
    lighthouse = service.lift_element(db_session, series, "location", one.story.id, one.lighthouse.id)

    coast2 = _adopt(db_session, series, coast, two)
    assert _adopt(db_session, series, lighthouse, two).parent_id == coast2.id
    assert _adopt(db_session, series, lighthouse, three).parent_id is None


def test_an_event_keeps_its_era_when_the_era_came_too(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    era = service.lift_element(db_session, series, "era", one.story.id, one.era.id)
    storm = service.lift_element(db_session, series, "historical_event", one.story.id, one.storm.id)
    era2 = _adopt(db_session, series, era, two)
    storm2 = _adopt(db_session, series, storm, two)
    assert isinstance(storm2, HistoricalEvent) and storm2.era_id == era2.id


def test_linking_a_row_the_book_already_has(db_session, test_user):
    one = make_book(db_session, test_user)
    two = make_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two.story)
    element = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)

    service.link_existing(db_session, series, element, two.story.id, two.eleanor.id)

    assert service.member_in(element, two.story.id).ref_id == two.eleanor.id
    with pytest.raises(service.SeriesError):
        service.link_existing(db_session, series, element, two.story.id, two.visitor.id)
    with pytest.raises(service.SeriesError):
        service.link_existing(db_session, series, element, two.story.id, one.visitor.id)


def test_leaving_keeps_the_rows_and_drops_the_links(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    shared = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    only_two = service.lift_element(db_session, series, "character", one.story.id, one.visitor.id)
    el2 = _adopt(db_session, series, shared, two)
    service.unlink_member(db_session, series, only_two, one.story.id)  # now in no book
    assert only_two not in series.elements

    service.detach_story(db_session, two.id)

    assert db_session.get(Character, el2.id) is not None
    assert service.membership(db_session, two.id) is None
    assert [m.story_id for m in shared.members] == [one.story.id]

    service.detach_story(db_session, one.story.id)
    assert db_session.query(Series).count() == 0, "a series with no books goes"
    assert db_session.query(SeriesElement).count() == 0


def test_prune_forgets_deleted_rows_and_follows_renames(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    element = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    el2 = _adopt(db_session, series, element, two)

    el2.name = "Eleanor Hale"
    db_session.flush()
    assert service.prune_dead_members(db_session, series) == 0
    assert element.name == "Eleanor Hale", "the latest book's name"

    db_session.delete(el2)
    db_session.flush()
    assert service.prune_dead_members(db_session, series) == 1
    assert [m.story_id for m in element.members] == [one.story.id]
    assert element.name == "Eleanor"


def test_undo_takes_the_element_back_out_of_the_book_and_redo_brings_it_back(db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    series = _series(db_session, test_user, one.story, two)
    eleanor = service.lift_element(db_session, series, "character", one.story.id, one.eleanor.id)
    visitor = service.lift_element(db_session, series, "character", one.story.id, one.visitor.id)
    vis2 = _adopt(db_session, series, visitor, two)
    el2 = _adopt(db_session, series, eleanor, two)
    db_session.commit()

    result = change_log.undo_latest(db_session, two.id, None, None)

    assert result is not None and "Eleanor" in result.label
    assert db_session.get(Character, el2.id) is None
    db_session.refresh(eleanor)
    assert service.member_in(eleanor, two.id) is None
    assert db_session.get(Character, vis2.id) is not None

    change_log.redo_latest(db_session, two.id, None, None)
    db_session.refresh(eleanor)
    assert service.member_in(eleanor, two.id).ref_id == el2.id
    assert db_session.query(CharacterRelationship).filter(CharacterRelationship.character_id == el2.id).count() == 1
    assert db_session.query(Story).count() == 2
    assert db_session.query(Location).count() == 2
