"""The story in numbers (doc 13 P3)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.nlp_runs import run_prose_analysis
from app.services.numbers import form_for
from tests.fixtures.findings_story import build_findings_story


def test_words_by_status_and_per_scene(client: TestClient, db_session: Session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Arrival"].status = "final"
    nodes["The Lamp"].status = "revised"
    db_session.commit()

    words = client.get(f"/api/stories/{story.id}/numbers").json()["words"]

    assert words["scenes"] == 6
    assert words["written_scenes"] == 6
    assert words["by_status"]["final"] == nodes["Arrival"].word_count
    assert words["by_status"]["revised"] == nodes["The Lamp"].word_count
    assert words["total"] == sum(n.word_count for t, n in nodes.items() if not t.startswith("Chapter"))
    assert words["mean_per_scene"] > 0


def test_a_story_past_its_form_says_what_it_reads_as(client: TestClient, db_session: Session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    story.intended_length = "flash_fiction"
    nodes["Arrival"].word_count = 3000
    db_session.commit()

    words = client.get(f"/api/stories/{story.id}/numbers").json()["words"]

    assert words["target"]["warning_level"] == "exceeded"
    assert words["reads_as"] == "short_story"


def test_a_story_inside_its_form_suggests_nothing(client: TestClient, db_session: Session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    story.intended_length = "novel"
    db_session.commit()

    words = client.get(f"/api/stories/{story.id}/numbers").json()["words"]

    assert words["target"]["warning_level"] == "normal"
    assert words["reads_as"] is None


def test_form_for():
    assert form_for(500) == "flash_fiction"
    assert form_for(20_000) == "novella"
    assert form_for(250_000) == "epic_saga"


def test_prose_is_empty_until_the_local_checks_run(client: TestClient, db_session: Session, test_user):
    story, _ = build_findings_story(db_session, test_user)

    assert client.get(f"/api/stories/{story.id}/numbers").json()["prose"] is None

    run_prose_analysis(story.id, test_user.id, db_session)
    db_session.commit()
    prose = client.get(f"/api/stories/{story.id}/numbers").json()["prose"]

    assert prose["scenes"] == 6
    assert prose["mean_sentence"] > 0
    assert sum(b["count"] for b in prose["sentence_lengths"]) >= 6
    assert len(prose["by_scene"]) == 6


def test_summaries_fresh_stale_missing(client: TestClient, db_session: Session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Arrival"].content_summary = "She arrives."
    nodes["Arrival"].summary_stale = False
    nodes["The Lamp"].content_summary = "She lights it."
    nodes["The Lamp"].summary_stale = True
    db_session.commit()

    assert client.get(f"/api/stories/{story.id}/numbers").json()["summaries"] == {
        "fresh": 1,
        "stale": 1,
        "missing": 4,
    }


def test_dialogue_counts_lines_and_balance(client: TestClient, db_session: Session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content = (
        '<p>"Is anyone there?" Eleanor asked.</p><p>"Only the wind," Margaret said.</p>'
        '<p>"It has been a long winter," Eleanor said.</p>'
    )
    db_session.commit()

    dialogue = client.get(f"/api/stories/{story.id}/numbers").json()["dialogue"]

    assert dialogue["total_lines"] == 3
    spoken = sum(s["line_count"] for s in dialogue["speakers"])
    assert spoken + dialogue["unattributed"] == 3
    assert all(s["speaker_name"] != "Unknown" for s in dialogue["speakers"])


def test_untagged_lines_are_not_a_speaker(client: TestClient, db_session: Session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content = '<p>"Hello."</p><p>"Is anyone there?"</p><p>"Only the wind."</p>'
    db_session.commit()

    dialogue = client.get(f"/api/stories/{story.id}/numbers").json()["dialogue"]

    assert dialogue["unattributed"] == 3
    assert dialogue["speakers"] == []
    assert dialogue["balance"] is None
    assert dialogue["monologue_scenes"] == []


def test_unknown_story_is_404(client: TestClient):
    assert client.get("/api/stories/nope/numbers").status_code == 404
