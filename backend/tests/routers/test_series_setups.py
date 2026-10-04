"""Setups that pay off in another book, the series' tapestry by book, and the story so far."""

from app.models import Series, SeriesSceneLink
from app.models.plot_thread import PlotThreadAppearance
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.structure import StructureNode
from app.services import snapshot_service as svc
from tests.fixtures.series_factory import empty_book, scenes, thread, twist


def _two_books(client, db_session, test_user):
    one = empty_book(db_session, test_user, "The Last Lighthouse")
    two = empty_book(db_session, test_user, "The Keeper's Daughter")
    [a1, a2] = scenes(db_session, one, "The Light", "The New Entry")
    [b1, b2] = scenes(db_session, two, "One Year On", "The Letter")
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Lighthouse Years", "story_ids": [one.id, two.id]}).json()["id"]
    return sid, one, two, (a1, a2), (b1, b2)


def _link(client, sid, here, node, other, other_node, **kw):
    body = {"story_id": here.id, "node_id": node.id, "other_story_id": other.id, "other_node_id": other_node.id}
    return client.post(f"/api/series/{sid}/scene-links", json={**body, **kw})


def test_a_setup_pays_off_in_the_next_book_and_undoes_where_it_was_made(client, db_session, test_user):
    sid, one, two, (a1, a2), (b1, b2) = _two_books(client, db_session, test_user)
    # Made from the payoff's end: still kept earlier book first.
    r = _link(client, sid, two, b1, one, a2, link_type="callback", note="The log again")
    assert r.status_code == 201
    link = r.json()
    assert (link["source"]["title"], link["target"]["title"]) == ("The New Entry", "One Year On")
    assert (link["source"]["position"], link["target"]["position"]) == (0, 1)

    [out] = client.get(f"/api/stories/{one.id}/promises").json()["series_setups"]
    assert (out["direction"], out["node_id"], out["other"]["title"]) == ("out", a2.id, "One Year On")
    [came] = client.get(f"/api/stories/{two.id}/promises").json()["series_setups"]
    assert (came["direction"], came["node_id"], came["note"]) == ("in", b1.id, "The log again")
    assert client.get(f"/api/series/{sid}/promises").json()["setups"][0]["id"] == link["id"]

    # Undone in the book it was made in: Book 2, not Book 1.
    assert client.post(f"/api/stories/{one.id}/undo").status_code == 404
    assert client.post(f"/api/stories/{two.id}/undo").status_code == 200
    assert db_session.query(SeriesSceneLink).count() == 0


def test_setups_across_books_are_refused_inside_one_book(client, db_session, test_user):
    sid, one, two, (a1, a2), (b1, b2) = _two_books(client, db_session, test_user)
    assert _link(client, sid, one, a1, one, a2).status_code == 400
    assert _link(client, sid, one, a1, two, b1, link_type="nonsense").status_code == 400
    assert _link(client, sid, one, b1, two, a1).status_code == 404, "each scene is checked against its own book"


def test_links_go_with_a_book_and_hold_through_a_restore(client, db_session, test_user):
    sid, one, two, (a1, a2), (b1, b2) = _two_books(client, db_session, test_user)
    one_id, two_id, a1_id, b1_id, b2_id = one.id, two.id, a1.id, b1.id, b2.id
    _link(client, sid, one, a1, two, b2)
    snap = svc.create_snapshot(two.id, db_session, trigger="manual", name="before")
    svc.restore_snapshot(snap, db_session, create_safety_backup=False)
    db_session.expire_all()
    assert len(client.get(f"/api/series/{sid}/promises").json()["setups"]) == 1, "the scenes came back"

    db_session.delete(db_session.get(StructureNode, b2_id))
    db_session.commit()
    assert client.get(f"/api/series/{sid}/promises").json()["setups"] == []
    assert db_session.query(SeriesSceneLink).count() == 0, "pruned by the series endpoint"

    body = {"story_id": one_id, "node_id": a1_id, "other_story_id": two_id, "other_node_id": b1_id}
    assert client.post(f"/api/series/{sid}/scene-links", json=body).status_code == 201
    assert client.delete(f"/api/stories/{one_id}").status_code == 204, "a link never blocks deleting a book"
    assert db_session.query(SeriesSceneLink).count() == 0


def test_the_series_tapestry_and_the_story_so_far(client, db_session, test_user):
    sid, one, two, (a1, a2), (b1, b2) = _two_books(client, db_session, test_user)
    one.synopsis = "Eleanor learns why her father kept the logs."
    silence = thread(db_session, one, "Margaret's Silence", (a2, "opens"))
    told = twist(
        db_session,
        one,
        "The Letter",
        (a1, "misdirection", "It is from the ministry."),
        truth="Margaret wrote it.",
    )
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
    for row, kind in ((silence, "plot_thread"), (told, "twist")):
        el = client.post(f"/api/series/{sid}/elements", json={"kind": kind, "story_id": one.id, "ref_id": row.id})
        eid = next(e["id"] for e in el.json()["elements"] if e["name"] == row.name)
        series = client.post(f"/api/series/{sid}/elements/{eid}/members", json={"story_id": two.id}).json()
        copy = next(e for e in series["elements"] if e["id"] == eid)["members"][1]["ref_id"]
        if kind == "plot_thread":
            db_session.add(PlotThreadAppearance(thread_id=copy, node_id=b2.id, role="moves"))
        else:
            from app.models.twist import Twist

            db_session.get(Twist, copy).revealed_at_node_id = b2.id
    db_session.commit()

    view = client.get(f"/api/series/{sid}/promises").json()
    assert [b["title"] for b in view["books"]] == ["The Last Lighthouse", "The Keeper's Daughter"]
    lanes = {lane["name"]: lane for lane in view["lanes"]}
    assert lanes["Margaret's Silence"]["status"] == "open"
    assert [s["roles"] for s in lanes["Margaret's Silence"]["steps"]] == [["opens"], ["moves"]]
    assert lanes["The Letter"]["status"] == "revealed" and lanes["The Letter"]["steps"][1]["reveal"] == "The Letter"

    first, second = client.get(f"/api/series/{sid}/story-so-far").json()
    assert first["summary"] == "Eleanor learns why her father kept the logs."
    [belief] = first["believes"]
    assert belief["text"] == "It is from the ministry." and belief["over"] == "Book 2 · The Letter"
    assert [i["text"] for i in first["only"]] == ["The lamp is failing."]
    assert {o["name"] for o in first["open"]} == {"Margaret's Silence", "The Letter"}
    assert [i["text"] for i in second["learned"]] == ["Margaret wrote it."]
    assert [o["name"] for o in second["open"]] == ["Margaret's Silence"]
    assert db_session.get(Series, sid) is not None
