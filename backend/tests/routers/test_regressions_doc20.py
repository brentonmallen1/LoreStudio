"""Regression tests for the defects doc 20 found on the way (notes/refactor-2026-09/20-*).

Each failed before its fix: a rename or new pronouns could not be undone, agreement was
"fixed" across the whole scene, and the panel's persona had drifted from the interview's.
"""

from types import SimpleNamespace

from app.models.character import Character
from app.services.llm.prompts.interviews import build_character_interview_system_prompt
from app.services.llm.prompts.panel import build_panel_character_prompt
from app.services.pronoun_service import apply_proposals_to_html
from tests.fixtures.findings_story import build_findings_story

H = {"X-Client-Id": "tab-doc20"}


def _eleanor(db, story):
    return db.query(Character).filter(Character.story_id == story.id, Character.name == "Eleanor Vance").one()


def test_a_rename_undoes_with_its_scenes(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    storm = nodes["The Storm"]
    storm.content = "<p>@Eleanor Vance held the rail.</p>"
    db_session.commit()

    body = {"old_name": "Eleanor Vance", "new_name": "Nell Vance", "node_ids": [storm.id]}
    assert client.post(f"/api/characters/{eleanor.id}/apply-rename", json=body, headers=H).status_code == 200
    db_session.refresh(storm)
    assert "@Nell Vance" in storm.content

    r = client.post(f"/api/stories/{story.id}/undo", headers=H)
    assert r.status_code == 200, r.text
    db_session.refresh(storm)
    db_session.refresh(eleanor)
    assert storm.content == "<p>@Eleanor Vance held the rail.</p>"
    assert eleanor.name == "Eleanor Vance"


def test_new_pronouns_undo_with_their_scenes(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    eleanor.pronouns = "she/her"
    storm = nodes["The Storm"]
    storm.content = "<p>She held the rail and she was cold.</p>"
    db_session.commit()

    body = {
        "new_pronouns": "they/them",
        "rewrites": [{"node_id": storm.id, "original": "she was cold", "rewritten": "they was cold"}],
    }
    r = client.post(f"/api/characters/{eleanor.id}/apply-pronoun-refactor", json=body, headers=H)
    assert r.status_code == 200, r.text
    db_session.refresh(storm)
    assert storm.content == "<p>She held the rail and they were cold.</p>"

    assert client.post(f"/api/stories/{story.id}/undo", headers=H).status_code == 200
    db_session.refresh(storm)
    db_session.refresh(eleanor)
    assert storm.content == "<p>She held the rail and she was cold.</p>"
    assert eleanor.pronouns == "she/her"


def test_agreement_is_fixed_only_where_the_pronoun_changed():
    html = '<p>"They was here first," said Tam. She was cold.</p>'
    out = apply_proposals_to_html(html, [{"original": "She was cold", "rewritten": "They was cold"}], "they/them")
    # Tam's own "They was" is dialect, and stays.
    assert out == '<p>"They was here first," said Tam. They were cold.</p>'


def _person(**kw):
    base = dict(
        id="c1", name="Ash", pronouns="", role="protagonist", character_type="", jungian_archetype="",
        narrative_archetype="", mission_statement="", personality="", motivation="", background="",
        appearance="", flaws="", quirks="", speech_patterns="", traits={}, attributes={},
    )  # fmt: skip
    return SimpleNamespace(**{**base, **kw})


def test_the_panel_persona_is_the_interview_persona():
    ash = _person(pronouns="they/them", flaws="Cannot ask for help", quirks="Hums", speech_patterns="Clipped")
    interview = build_character_interview_system_prompt(ash)
    panel = build_panel_character_prompt(ash, [], [])
    for line in ("Your pronouns: they/them", "Cannot ask for help", "Hums", "Clipped"):
        assert line in interview
        assert line in panel


def test_the_people_in_the_room_are_named_with_their_pronouns():
    ash, bea = _person(), _person(id="c2", name="Bea", pronouns="she/her")
    assert "Bea (she/her)" in build_panel_character_prompt(ash, [bea], [])


def test_how_they_think_never_ranks_or_tells_the_persona_to_falter():
    prompt = build_character_interview_system_prompt(_person(attributes={"intelligence": "slow"}))
    assert "haltingly" not in prompt
    assert "stupid" not in prompt
    assert "at your own pace" in prompt
