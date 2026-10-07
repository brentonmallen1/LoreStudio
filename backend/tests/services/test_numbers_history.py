"""When readings are taken, how long they are kept, and where they travel (doc 19, R1)."""

import io
import json
import zipfile
from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models.ai_job import AIJob
from app.models.numbers_reading import NumbersReading
from app.models.snapshot import StorySnapshot
from app.models.story import Story
from app.services import numbers_history
from app.services.numbers_history import backfill, record, thin, visit
from app.services.snapshot_export import export_snapshot, import_snapshot_file
from app.services.snapshot_service import _get_or_create_settings, create_snapshot
from tests.fixtures.findings_story import build_findings_story


@pytest.fixture
def story(db_session: Session, test_user) -> Story:
    built, _ = build_findings_story(db_session, test_user)
    return built


def _readings(db: Session, story: Story) -> list[NumbersReading]:
    return db.query(NumbersReading).filter(NumbersReading.story_id == story.id).order_by(NumbersReading.taken_at).all()


def test_a_visit_after_three_hours_away_starts_a_session(story: Story, db_session: Session):
    assert visit(story.id, db_session) == "session"
    assert visit(story.id, db_session) is None  # five minutes later, the same session

    settings = _get_or_create_settings(story.id, db_session)
    settings.numbers_seen_at -= timedelta(hours=3)
    db_session.commit()
    assert visit(story.id, db_session) == "session"


def test_a_long_session_gets_one_daily_reading(story: Story, db_session: Session):
    visit(story.id, db_session)
    settings = _get_or_create_settings(story.id, db_session)
    settings.numbers_checked_at -= timedelta(hours=1)
    db_session.commit()
    assert visit(story.id, db_session) == "daily"  # no reading today yet

    record(story.id, db_session, trigger="daily")
    settings.numbers_checked_at -= timedelta(hours=1)
    db_session.commit()
    assert visit(story.id, db_session) is None  # one a day


def test_an_unchanged_book_is_not_measured_twice_a_day(story: Story, db_session: Session):
    assert record(story.id, db_session, trigger="session") is not None
    assert record(story.id, db_session, trigger="daily", only_if_changed=True) is None
    assert record(story.id, db_session, trigger="manual") is not None  # by hand, always


def test_thinning_keeps_two_weeks_then_a_day_then_a_week(story: Story, db_session: Session):
    base = record(story.id, db_session, trigger="manual")
    # A fixed noon on a Wednesday, so the day and week buckets never depend on when this runs:
    # at 00:30 UTC, 30 and 30.2 days back fell on different days and both were kept.
    now = datetime(2026, 6, 10, 12, 0)

    def at(days: float, **kw) -> NumbersReading:
        r = NumbersReading(story_id=story.id, taken_at=now - timedelta(days=days), data=base.data, **kw)
        db_session.add(r)
        return r

    recent = [at(1), at(1.1)]  # two in one day, inside two weeks: both kept
    day_late, day_early = at(30), at(30.2)  # one day a month ago: the later kept
    old_a, old_b = at(200), at(201)  # same week long ago: one kept
    version = at(400, label="Draft 1")  # a version: kept whatever its age
    db_session.commit()

    assert thin(story.id, db_session, now) == 2
    db_session.commit()
    kept = {r.id for r in _readings(db_session, story)}
    assert {r.id for r in recent} <= kept
    assert day_late.id in kept and day_early.id not in kept
    assert len({old_a.id, old_b.id} & kept) == 1
    assert version.id in kept


def test_backfill_measures_each_version_once(story: Story, db_session: Session):
    create_snapshot(story.id, db_session, trigger="manual", name="Draft 1")
    create_snapshot(story.id, db_session, trigger="manual")

    assert backfill(story.id, db_session) == {"measured": 2, "of": 2}
    readings = _readings(db_session, story)
    assert {r.trigger for r in readings} == {"backfill"}
    assert "Draft 1" in {r.label for r in readings}
    assert backfill(story.id, db_session) == {"measured": 0, "of": 0}


def test_check_auto_takes_the_session_reading(client, story: Story, db_session: Session):
    client.post(f"/api/stories/{story.id}/snapshots/check-auto")

    out = client.get(f"/api/stories/{story.id}/numbers/readings").json()
    assert [r["trigger"] for r in out["readings"]] == ["session"]
    assert out["readings"][0]["words"] > 0


def test_a_version_and_a_restore_each_add_a_reading(client, story: Story, db_session: Session):
    snap = client.post(f"/api/stories/{story.id}/snapshots", json={"name": "Before the storm"}).json()
    client.post(f"/api/stories/{story.id}/snapshots/{snap['id']}/restore", json={"create_safety_backup": False})

    readings = client.get(f"/api/stories/{story.id}/numbers/readings").json()["readings"]
    assert [(r["trigger"], r["label"]) for r in readings] == [("snapshot", "Before the storm"), ("restore", None)]
    one = client.get(f"/api/stories/{story.id}/numbers/readings/{readings[0]['id']}").json()
    assert one["data"]["words"]["total"] == readings[0]["words"]


def test_measure_now_and_the_backfill_job(client, story: Story, db_session: Session):
    assert client.post(f"/api/stories/{story.id}/numbers/readings").status_code == 202
    assert [r["trigger"] for r in client.get(f"/api/stories/{story.id}/numbers/readings").json()["readings"]] == [
        "manual"
    ]

    create_snapshot(story.id, db_session, trigger="auto", force=True)
    assert client.get(f"/api/stories/{story.id}/numbers/readings").json()["unmeasured_versions"] == 1
    job = client.post(f"/api/stories/{story.id}/numbers/readings/backfill").json()
    again = client.post(f"/api/stories/{story.id}/numbers/readings/backfill").json()
    assert job["kind"] == "numbers-backfill" and again["id"] == job["id"]
    assert db_session.query(AIJob).filter(AIJob.kind == "numbers-backfill").count() == 1


def test_readings_travel_in_an_export(story: Story, db_session: Session, test_user):
    record(story.id, db_session, trigger="session")
    snap = create_snapshot(story.id, db_session, trigger="manual", name="Draft 1")
    record(story.id, db_session, trigger="snapshot", label="Draft 1", snapshot_id=snap.id)
    record(story.id, db_session, trigger="manual")  # after the version: not in its export

    archive = export_snapshot(db_session.get(StorySnapshot, snap.id), db_session)
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        carried = json.loads(zf.read("numbers_readings.json"))
    assert [r["trigger"] for r in carried] == ["session", "snapshot"]

    parsed = import_snapshot_file(archive)
    other, _ = build_findings_story(db_session, test_user)
    assert numbers_history.adopt(other.id, parsed["readings"], db_session) == 2
    db_session.commit()
    assert numbers_history.adopt(other.id, parsed["readings"], db_session) == 0  # not doubled
    assert {r.label for r in _readings(db_session, other)} == {None, "Draft 1"}
