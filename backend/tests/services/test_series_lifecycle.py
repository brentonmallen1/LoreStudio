"""What the series tables do when a book is deleted or restored.

They are deliberately not in a story's snapshot (snapshot_service.SNAPSHOT_EXCLUDED_TABLES),
so the delete and snapshot completeness tests do not walk them. These tests are the
guard instead.
"""

from app.models import Character, Series, SeriesElement, SeriesElementMember, SeriesStory
from app.services import snapshot_service as svc
from app.services.series import service
from tests.fixtures.series_factory import empty_book, make_book


def _two_books(db, user):
    one = make_book(db, user)
    two = empty_book(db, user, "Book Two")
    series = service.create_series(db, user.id, "The Lighthouse Years")
    service.attach_story(db, series, one.story)
    service.attach_story(db, series, two)
    eleanor = service.lift_element(db, series, "character", one.story.id, one.eleanor.id)
    visitor = service.lift_element(db, series, "character", one.story.id, one.visitor.id)
    service.adopt_into_book(db, series, eleanor, two.id, actor_id=None, client_id=None)
    db.commit()
    return series, one, two, eleanor, visitor


def test_deleting_a_book_leaves_nothing_of_it_in_the_series(client, db_session, test_user):
    series, one, two, eleanor, visitor = _two_books(db_session, test_user)

    assert client.delete(f"/api/stories/{one.story.id}").status_code == 204

    db_session.expire_all()
    assert db_session.query(SeriesStory).filter(SeriesStory.story_id == one.story.id).count() == 0
    assert db_session.query(SeriesElementMember).filter(SeriesElementMember.story_id == one.story.id).count() == 0
    assert db_session.get(SeriesElement, visitor.id) is None, "only book one had the visitor"
    assert [m.story_id for m in db_session.get(SeriesElement, eleanor.id).members] == [two.id]
    assert [b.position for b in db_session.get(Series, series.id).books] == [0]

    assert client.delete(f"/api/stories/{two.id}").status_code == 204
    assert db_session.query(Series).count() == 0
    assert db_session.query(SeriesElementMember).count() == 0


def test_a_snapshot_never_carries_the_series(db_session, test_user):
    series, one, two, eleanor, visitor = _two_books(db_session, test_user)
    state = svc.serialize_story(two.id, db_session)
    assert not {"series", "series_stories", "series_elements", "series_element_members"} & set(state)


def test_restoring_a_book_keeps_its_links(db_session, test_user):
    series, one, two, eleanor, visitor = _two_books(db_session, test_user)
    snap = svc.create_snapshot(two.id, db_session, trigger="manual", name="before")
    member = service.member_in(eleanor, two.id)
    db_session.get(Character, member.ref_id).personality = "Changed after the snapshot."
    db_session.commit()

    svc.restore_snapshot(snap, db_session, create_safety_backup=False)

    db_session.expire_all()
    restored = db_session.get(Character, member.ref_id)
    assert restored is not None and restored.personality == "Guarded."
    assert service.prune_dead_members(db_session, db_session.get(Series, series.id)) == 0


def test_a_link_to_a_row_the_restore_removed_is_pruned(db_session, test_user):
    series, one, two, eleanor, visitor = _two_books(db_session, test_user)
    snap = svc.create_snapshot(two.id, db_session, trigger="manual", name="before the visitor")
    service.adopt_into_book(db_session, series, visitor, two.id, actor_id=None, client_id=None)
    db_session.commit()

    svc.restore_snapshot(snap, db_session, create_safety_backup=False)

    db_session.expire_all()
    fresh = db_session.get(Series, series.id)
    assert service.prune_dead_members(db_session, fresh) == 1
    assert [m.story_id for m in db_session.get(SeriesElement, visitor.id).members] == [one.story.id]
