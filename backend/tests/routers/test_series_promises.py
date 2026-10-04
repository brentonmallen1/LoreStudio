"""Promises across books through the API: the left-open finding, its fix, one word for all."""

from app.models import FindingDismissal
from app.models.plot_thread import PlotThread, PlotThreadAppearance
from tests.fixtures.series_factory import empty_book, scenes, thread


def _two_books(client, db_session, test_user):
    one = empty_book(db_session, test_user, "The Last Lighthouse")
    two = empty_book(db_session, test_user, "The Keeper's Daughter")
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Lighthouse Years", "story_ids": [one.id, two.id]}).json()["id"]
    return sid, one, two


def _findings(client, story_id, check):
    return [f for f in client.get(f"/api/stories/{story_id}/findings").json()["findings"] if f["check"] == check]


def test_a_thread_left_open_is_brought_into_the_next_book(client, db_session, test_user):
    sid, one, two = _two_books(client, db_session, test_user)
    [s1] = scenes(db_session, one, "Margaret's Visit")
    silence = thread(db_session, one, "Margaret's Silence", (s1, "opens"))
    db_session.commit()

    [f] = _findings(client, one.id, "series-left-open")
    assert f["text"] == "Margaret's Silence is still open at the end of this book, and no later book picks it up"
    assert f["anchor"]["thread_id"] == silence.id and f["fix"]["kind"] == "carry" and f["fix"]["story_id"] == two.id
    assert _findings(client, two.id, "series-left-open") == []
    [gathered] = client.get(f"/api/series/{sid}/findings").json()
    assert gathered["check"] == "series-left-open" and gathered["ref_id"] == silence.id
    assert gathered["story_ids"] == [one.id] and gathered["element_id"] is None

    assert client.post(f"/api/stories/{one.id}/findings/{f['id']}/fix").status_code == 200
    assert _findings(client, one.id, "series-left-open") == []
    carried = db_session.query(PlotThread).filter(PlotThread.story_id == two.id).one()
    assert carried.name == "Margaret's Silence"
    promises = client.get(f"/api/stories/{two.id}/promises").json()
    assert promises["across"][carried.id]["from_book"] == 0
    assert [o["name"] for o in promises["open_from_earlier"]] == ["Margaret's Silence"]

    # Undone in the book it was brought into, it is left open again.
    assert client.post(f"/api/stories/{two.id}/undo").status_code == 200
    assert len(_findings(client, one.id, "series-left-open")) == 1


def test_a_series_thread_s_finding_is_dismissed_in_every_book(client, db_session, test_user):
    sid, one, two = _two_books(client, db_session, test_user)
    [a1] = scenes(db_session, one, "One")
    [b1] = scenes(db_session, two, "Two")
    keeper = thread(db_session, one, "The Keeper", (a1, "opens"))
    db_session.commit()
    el = client.post(
        f"/api/series/{sid}/elements", json={"kind": "plot_thread", "story_id": one.id, "ref_id": keeper.id}
    ).json()["elements"][0]
    series = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id}).json()
    copy_id = series["elements"][0]["members"][1]["ref_id"]
    db_session.add(PlotThreadAppearance(thread_id=copy_id, node_id=b1.id, role="opens"))
    db_session.commit()

    [f] = _findings(client, two.id, "series-opens-again")
    assert f["anchor"]["series_element_id"] == el["id"] and f["anchor"]["thread_id"] == copy_id
    assert client.post(f"/api/stories/{two.id}/findings/{f['id']}/dismiss").status_code == 204
    held = {d.story_id for d in db_session.query(FindingDismissal).filter(FindingDismissal.fingerprint == f["id"])}
    assert held == {one.id, two.id}


def test_carry_over_offers_open_threads_ticked(client, db_session, test_user):
    one = empty_book(db_session, test_user, "Alone")
    [s1, s2] = scenes(db_session, one, "One", "Two")
    thread(db_session, one, "Asked", (s1, "opens"))
    thread(db_session, one, "Answered", (s1, "opens"), (s2, "closes"))
    db_session.commit()
    offered = {
        c["name"]: (c["lore_kind"], c["preselect"])
        for c in client.get(f"/api/stories/{one.id}/carry-over").json()
        if c["kind"] == "plot_thread"
    }
    assert offered == {"Asked": ("thread", True)}
