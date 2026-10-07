"""
Automatic work (doc 22): every task has a switch and options, one switch pauses them all, the
housekeeping runs on a schedule as quiet jobs, and each run is recorded for the page.
"""

from datetime import timedelta

import pytest

from app.config import settings as env
from app.models.ai_job import AIJob
from app.models.change import Change
from app.models.story import Story
from app.services import automatic
from app.services.job_queue import enqueue
from tests.fixtures.jobs import run_queued


@pytest.fixture(autouse=True)
def no_backups_on_disk(tmp_path, monkeypatch):
    """The database backup's schedule counts files already on disk; these tests have none."""
    monkeypatch.setattr(env, "backups_path", str(tmp_path))


@pytest.fixture
def admin(db_session, test_user):
    test_user.is_admin = True
    db_session.commit()
    return test_user


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


def test_the_defaults_are_the_values_that_ran_before(db_session):
    assert automatic.task_settings(db_session, "prune-undo") == {"enabled": True, "keep": 10_000}
    assert automatic.task_settings(db_session, "numbers-readings") == {
        "enabled": True,
        "away_hours": 3,
        "daily": True,
        "with_versions": True,
        "after_restore": True,
    }
    assert automatic.option(db_session, "db-backup", "keep") == env.db_backup_keep
    assert not automatic.paused(db_session)


def test_settings_are_checked(db_session):
    automatic.update(db_session, tasks={"prune-undo": {"keep": 500, "enabled": False}})
    assert automatic.task_settings(db_session, "prune-undo") == {"enabled": False, "keep": 500}
    assert not automatic.is_on(db_session, "prune-undo")
    for bad in ({"nope": {}}, {"prune-undo": {"color": 1}}, {"prune-undo": {"keep": 5}}, {"db-backup": {"keep": True}}):
        with pytest.raises(ValueError):
            automatic.update(db_session, tasks=bad)


def test_the_housekeeping_is_queued_when_due_and_not_again(db_session, admin):
    queued = automatic.schedule_due(db_session)
    kinds = {j.kind for j in queued}
    assert kinds == {"auto-prune-undo", "auto-prune-payloads", "auto-prune-jobs"} | (
        {"auto-db-backup"} if env.db_backup_enabled else set()
    )
    assert all(j.quiet and j.origin == "auto" and j.user_id == admin.id and j.lane == "local" for j in queued)
    assert automatic.schedule_due(db_session) == []  # still queued: not twice

    run_queued(db_session, "local")
    assert automatic.schedule_due(db_session) == []  # ran just now: not due for a day
    run = automatic.last_run(db_session, "prune-jobs")
    assert run["ok"] and run["summary"] == "Nothing was old enough"


def test_paused_or_off_nothing_is_queued(db_session, admin):
    automatic.update(db_session, paused_=True)
    assert automatic.schedule_due(db_session) == []
    automatic.update(db_session, paused_=False, tasks={t: {"enabled": False} for t in automatic.TASKS_BY_ID})
    assert automatic.schedule_due(db_session) == []


def test_trimming_the_undo_history_keeps_the_newest(db_session, admin, story):
    for i in range(150):
        db_session.add(Change(story_id=story.id, entity_type="character", entity_id=str(i), action="update"))
    db_session.commit()
    automatic.update(db_session, tasks={"prune-undo": {"keep": 100}})
    automatic.queue_task(db_session, automatic.TASKS_BY_ID["prune-undo"], by=admin)

    (job,) = run_queued(db_session, "local")
    assert job.status == "done" and job.result == {"summary": "Removed 50 old changes"}
    assert db_session.query(Change).count() == 100
    assert not job.quiet and job.origin == "author"  # Run now is the author's


def test_a_database_that_is_not_a_file_is_not_backed_up(db_session, admin):
    automatic.queue_task(db_session, automatic.TASKS_BY_ID["db-backup"], by=admin)
    (job,) = run_queued(db_session, "local")
    assert job.result["summary"] == "Skipped: the database is not a file"


def test_resume_after_a_restart_can_be_turned_off(db_session, admin, story):
    job = enqueue(db_session, kind="numbers-reading", user_id=admin.id, story_id=story.id, label="Measuring")
    job.status = "running"
    db_session.commit()
    automatic.update(db_session, tasks={"restart-recovery": {"enabled": False}})
    automatic.at_start(db_session)
    db_session.refresh(job)
    assert job.status == "error" and job.error == "Interrupted by a restart."
    assert automatic.last_run(db_session, "restart-recovery")["summary"] == "Marked 1 job interrupted"


def test_the_next_run_is_its_interval_after_the_last(db_session, admin):
    task = automatic.TASKS_BY_ID["prune-jobs"]
    automatic.record_run(db_session, task.id, "Forgot 2 old jobs")
    last = automatic._last_at(db_session, task)
    assert automatic.next_at(db_session, task) == last + timedelta(days=1)
    assert automatic.next_at(db_session, automatic.TASKS_BY_ID["story-backups"]) is None


def test_an_open_story_obeys_the_switches(client, db_session, story):
    automatic.update(db_session, tasks={"story-backups": {"enabled": False}, "numbers-readings": {"enabled": False}})
    assert client.post(f"/api/stories/{story.id}/snapshots/check-auto").json() == {"created": False}
    assert db_session.query(AIJob).filter(AIJob.kind == "numbers-reading").count() == 0

    automatic.update(db_session, tasks={"story-backups": {"enabled": True}, "numbers-readings": {"enabled": True}})
    client.post(f"/api/stories/{story.id}/snapshots/check-auto")
    assert db_session.query(AIJob).filter(AIJob.kind == "numbers-reading").count() == 1


def test_the_page_reads_for_anyone_and_changes_for_an_admin(client, db_session, test_user):
    page = client.get("/api/automatic").json()
    assert page["can_edit"] is False and not page["paused"]
    undo = next(t for t in page["tasks"] if t["id"] == "prune-undo")
    assert undo["cadence"] == "Once a day, keeping the last 10,000 changes in each story" and undo["can_run_now"]
    assert client.patch("/api/automatic", json={"paused": True}).status_code == 403

    test_user.is_admin = True
    db_session.commit()
    changed = client.patch("/api/automatic", json={"tasks": {"db-backup": {"every_hours": 12, "keep": 7}}}).json()
    backup = next(t for t in changed["tasks"] if t["id"] == "db-backup")
    assert backup["cadence"] == "Every 12 hours, keeping the last 7"
    assert client.patch("/api/automatic", json={"tasks": {"db-backup": {"keep": 0}}}).status_code == 422
    assert client.post("/api/automatic/prune-jobs/run").status_code == 201
    assert client.post("/api/automatic/story-backups/run").status_code == 404


def test_a_backup_on_disk_is_the_last_run(db_session, tmp_path):
    (tmp_path / "lorestudio-20261007-080000-000000.db").write_bytes(b"")
    run = automatic.last_run(db_session, "db-backup")
    assert run["summary"] == "Wrote lorestudio-20261007-080000-000000.db" and run["at"].startswith("2026-10-07T08:00")
    automatic.record_run(db_session, "db-backup", "Wrote a newer one")
    assert automatic.last_run(db_session, "db-backup")["summary"] == "Wrote a newer one"
