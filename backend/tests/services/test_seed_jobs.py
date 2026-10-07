"""Jobs in the demo (doc 21 R6): a new install opens on a check finished while away."""

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.ai_job import AIJob
from app.models.story import Story
from app.services import seed
from app.services.findings import collect


def test_the_lighthouse_has_a_check_finished_while_away_and_a_stopped_pass(db_session: Session, monkeypatch):
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()

    story = db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()
    jobs = {j.kind: j for j in db_session.query(AIJob).filter(AIJob.story_id == story.id)}
    check, stopped = jobs["check"], jobs["editorial-pass"]
    # Only the check is unseen: the header opens on its dot, not on old work.
    assert [j.kind for j in jobs.values() if j.seen_at is None] == ["check"]
    assert check.status == "done" and check.result["summary"].startswith("Pacing analysis")
    assert stopped.status == "cancelled" and (stopped.progress, stopped.total) == (2, 5)

    report = db_session.get(ActivityLog, stopped.result["report_id"])
    assert report.metadata_["error"] == "Stopped after 2 of 5 analyses."
    titles = {f.text for f in collect(story, db_session).findings}
    assert "Drags: The Logbook" in titles
    assert "Eleanor's reason for letting the Visitor in is not on the page" in titles
