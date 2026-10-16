"""A rewrite across the story reaches every take of a scene (doc 29 D7): a replace, new quotes
and a rename change the takes that do not count too, in the same change, so a take chosen later
does not bring back what was replaced, and one ⌘Z takes the whole rewrite back, takes included."""

from app.models import Character, SceneTake, StructureNode
from tests.fixtures.findings_story import build_findings_story

H = {"X-Client-Id": "tab-takes"}

COUNTS = "<p>@Eleanor Vance opened the door. Margaret waited.</p>"
OTHER = '<p>"Keeper," said @Eleanor Vance."Come in"&lt;Eleanor Vance&gt; Margaret knocked twice.</p>'


def _setup(client, db_session, test_user):
    """Arrival with two takes: take 1 counts, take 2 (open) reads differently."""
    story, nodes = build_findings_story(db_session, test_user)
    scene = nodes["Arrival"]
    scene.content = COUNTS
    db_session.commit()
    takes = client.post(f"/api/structure/{scene.id}/takes", headers=H).json()["takes"]
    r = client.put(f"/api/takes/{takes[1]['id']}/content", json={"content": OTHER, "word_count": 9}, headers=H)
    assert r.status_code == 200, r.text
    return story, nodes, takes[0]["id"], takes[1]["id"]


def _take(db_session, take_id) -> SceneTake:
    db_session.expire_all()
    return db_session.get(SceneTake, take_id)


def _prose(db_session, node) -> str:
    db_session.expire_all()
    return db_session.get(StructureNode, node.id).content


def _undo(client, story):
    r = client.post(f"/api/stories/{story.id}/undo", headers=H)
    assert r.status_code == 200, r.text
    return r.json()


def test_replace_reaches_the_other_takes_and_one_undo_puts_all_back(client, db_session, test_user):
    story, nodes, first, second = _setup(client, db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/replace", json={"query": "Margaret", "replacement": "Maggie"}, headers=H)
    assert r.status_code == 200, r.text
    out = r.json()
    # Arrival's prose and its other take; the count is the prose's, as Find listed it.
    assert out["replaced_count"] == 1 and out["in_other_takes"] == 1
    assert nodes["Arrival"].id in out["node_ids"]
    assert "Maggie waited." in _prose(db_session, nodes["Arrival"])
    take = _take(db_session, second)
    assert "Maggie knocked twice." in take.content and "Margaret" not in take.content
    assert take.word_count == 8  # recounted: the speaker tag is not words
    # The row of the take that counts still holds no copy.
    assert _take(db_session, first).content == ""

    undone = _undo(client, story)
    assert undone["label"] == "Replace “Margaret” with “Maggie” in “Arrival”"
    assert _prose(db_session, nodes["Arrival"]) == COUNTS
    take = _take(db_session, second)
    assert (take.content, take.word_count) == (OTHER, 9)


def test_replace_finds_a_scene_whose_only_match_is_in_another_take(client, db_session, test_user):
    story, nodes, _first, second = _setup(client, db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/replace", json={"query": "knocked", "replacement": "rapped"}, headers=H)
    out = r.json()
    assert (out["replaced_count"], out["scenes_affected"], out["in_other_takes"]) == (0, 0, 1)
    assert out["node_ids"] == [nodes["Arrival"].id]
    assert "Margaret rapped twice." in _take(db_session, second).content
    # Scoped to other scenes, Arrival's takes are left alone.
    r = client.post(
        f"/api/stories/{story.id}/replace",
        json={"query": "rapped", "replacement": "knocked", "node_ids": [nodes["Supper"].id]},
        headers=H,
    )
    assert r.json()["in_other_takes"] == 0
    assert "rapped" in _take(db_session, second).content
    _undo(client, story)
    assert _take(db_session, second).content == OTHER


def test_quotes_reach_the_other_takes(client, db_session, test_user):
    story, nodes, _first, second = _setup(client, db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/quotes/normalize", json={"style": "curly"}, headers=H)
    assert r.status_code == 200, r.text
    assert "“Keeper,” said" in _take(db_session, second).content
    _undo(client, story)
    assert _take(db_session, second).content == OTHER


def test_a_rename_in_the_review_reaches_the_other_takes_and_undoes_with_the_name(client, db_session, test_user):
    story, nodes, _first, second = _setup(client, db_session, test_user)
    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor Vance").one()
    review = client.post(
        f"/api/characters/{eleanor.id}/review", json={"name_from": "Eleanor Vance", "name_to": "Nell Vance"}
    ).json()
    items = [i for i in review["items"] if i["kind"] == "name"]
    r = client.post(
        f"/api/characters/{eleanor.id}/review/apply", json={"name": "Nell Vance", "items": items}, headers=H
    )
    assert r.status_code == 200, r.text
    assert "@Nell Vance opened" in _prose(db_session, nodes["Arrival"])
    take = _take(db_session, second)
    # Its mention and its speaker tag; nothing in the takes still says the old name, so no alias.
    assert "@Nell Vance." in take.content and "&lt;Nell Vance&gt;" in take.content
    assert "Eleanor" not in take.content
    assert "Eleanor Vance" not in r.json()["character"]["aliases"]

    _undo(client, story)
    db_session.expire_all()
    assert db_session.get(Character, eleanor.id).name == "Eleanor Vance"
    assert _take(db_session, second).content == OTHER
    assert _prose(db_session, nodes["Arrival"]) == COUNTS


def test_apply_rename_previews_and_reaches_the_other_takes(client, db_session, test_user):
    story, nodes, _first, second = _setup(client, db_session, test_user)
    # The prose that counts no longer names her; take 2 still does.
    nodes["Arrival"].content = "<p>Margaret waited.</p>"
    db_session.commit()
    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor Vance").one()
    preview = client.post(f"/api/characters/{eleanor.id}/preview-rename", json={"new_name": "Nell Vance"}).json()
    arrival = next(s for s in preview["affected_scenes"] if s["node_id"] == nodes["Arrival"].id)
    assert (arrival["occurrences"], arrival["in_other_takes"]) == (2, 2)

    body = {"old_name": "Eleanor Vance", "new_name": "Nell Vance", "node_ids": [nodes["Arrival"].id]}
    r = client.post(f"/api/characters/{eleanor.id}/apply-rename", json=body, headers=H)
    assert r.status_code == 200, r.text
    assert "&lt;Nell Vance&gt;" in _take(db_session, second).content
    _undo(client, story)
    assert _take(db_session, second).content == OTHER


def test_a_take_still_naming_the_old_name_keeps_it_as_an_alias(client, db_session, test_user):
    story, nodes, _first, _second = _setup(client, db_session, test_user)
    nodes["Arrival"].content = "<p>Margaret waited.</p>"
    db_session.commit()
    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor Vance").one()
    # Renamed in another scene only: Arrival's take 2 still says Eleanor Vance.
    body = {"old_name": "Eleanor Vance", "new_name": "Nell Vance", "node_ids": [nodes["Supper"].id]}
    r = client.post(f"/api/characters/{eleanor.id}/apply-rename", json=body, headers=H)
    assert r.json()["aliases"] == ["Eleanor Vance"]


def test_skipping_the_review_leaves_the_takes_as_the_prose(client, db_session, test_user):
    story, nodes, _first, second = _setup(client, db_session, test_user)
    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor Vance").one()
    r = client.post(f"/api/characters/{eleanor.id}/review/apply", json={"name": "Nell Vance", "items": []}, headers=H)
    assert r.status_code == 200, r.text
    assert _take(db_session, second).content == OTHER
    assert "Eleanor Vance" in r.json()["character"]["aliases"]
