"""Talking to each other through its routes (doc 20 P7, R7)."""

from app.models.character import Character
from tests.fixtures.findings_story import build_findings_story


def _setup(db, user):
    story, nodes = build_findings_story(db, user)
    for c in db.query(Character).filter(Character.story_id == story.id):
        c.gender = "woman"
    nodes["The Storm"].content = (
        '<p>"Is it the light?"&lt;Eleanor Vance&gt; she asked.</p>'
        '<p>"It went dark at three."&lt;Margaret Holt&gt; she said.</p>'
    )
    db.commit()
    return story, nodes


def test_two_named_women_talking_is_found_and_described(client, db_session, test_user, mock_ai_gateway):
    story, nodes = _setup(db_session, test_user)
    out = client.get(f"/api/stories/{story.id}/numbers/talk").json()
    assert out["group"] == ["woman"]
    assert [s["node_id"] for s in out["scenes"]] == [nodes["The Storm"].id]
    exchange = out["scenes"][0]["exchanges"][0]
    assert exchange["lines"] == 2 and exchange["about"] is None

    mock_ai_gateway(
        structured_data={"exchanges": [{"id": exchange["id"], "about": "the light going dark", "about_a_man": False}]}
    )
    described = client.post(f"/api/stories/{story.id}/numbers/talk/subjects", json={"group": None}).json()
    got = described["scenes"][0]["exchanges"][0]
    assert (got["about"], got["about_a_man"]) == ("the light going dark", False)
    # Kept as a run: read back on the next visit.
    again = client.get(f"/api/stories/{story.id}/numbers/talk").json()["scenes"][0]["exchanges"][0]
    assert again["about"] == "the light going dark"


def test_another_group_is_looked_at_the_same_way_and_none_is_nobody(client, db_session, test_user):
    story, _ = _setup(db_session, test_user)
    out = client.get(f"/api/stories/{story.id}/numbers/talk", params={"group": ["man"]}).json()
    assert out["group"] == [] and out["people"] == 0 and out["scenes"] == []
