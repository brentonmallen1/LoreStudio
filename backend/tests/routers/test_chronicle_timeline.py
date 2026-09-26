"""
Chronicle › Activity: jobs and the calls they made, in one timeline.

A job used to say "Finished" and nothing else; the calls it made sat in another tab with
nothing tying them to it. These tests hold the link: every row a job writes carries its
id, a job opens onto exactly those rows, and the unfiltered timeline shows each piece of
work once.
"""

from datetime import datetime, timedelta

import anyio
import pytest

from app.models.activity_log import ActivityLog
from app.models.ai_job import AIJob
from app.models.story import Story
from app.services.job_queue import JOB_HANDLERS, current_job_id, enqueue, handler, run_job


def _call(user_id: str, story_id: str | None, *, status: str = "ok", feature: str = "scene-summary", **kw):
    """The shape of the row the gateway writes for an AI call."""
    return ActivityLog(
        user_id=user_id,
        story_id=story_id,
        event_type=f"ai_{feature.replace('-', '_')}",
        category="ai",
        description=kw.pop("description", f"{feature} call"),
        metadata_={"feature": feature, "status": status},
        **kw,
    )


@pytest.fixture
def story(db_session, test_user):
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    return story


@pytest.fixture(autouse=True)
def calling_handler():
    """A job that makes two AI calls, one of which fails, the way a real handler would."""
    original = dict(JOB_HANDLERS)

    @handler("test-two-calls")
    async def _two_calls(job, db, user, report):
        db.add(_call(user.id, job.story_id))
        db.add(_call(user.id, job.story_id, status="error"))
        # The summary row handlers write for themselves: tagged, but not a call.
        db.add(
            ActivityLog(user_id=user.id, story_id=job.story_id, event_type="run", category="health", description="done")
        )
        db.commit()
        report(2, 2)
        return {"summarized_count": 1, "failed_count": 1}

    yield
    JOB_HANDLERS.clear()
    JOB_HANDLERS.update(original)


def _run_two_call_job(db_session, test_user, story) -> AIJob:
    job = enqueue(db_session, kind="test-two-calls", user_id=test_user.id, story_id=story.id, label="Two calls")
    anyio.run(run_job, job, db_session)
    return job


def test_rows_written_during_a_job_carry_its_id(db_session, test_user, story):
    job = _run_two_call_job(db_session, test_user, story)
    rows = db_session.query(ActivityLog).all()
    assert len(rows) == 3
    assert {r.metadata_["job_id"] for r in rows} == {job.id}
    # And the marker does not leak into work done after the job ends.
    assert current_job_id.get() is None


def test_a_call_made_outside_a_job_has_no_job_id(db_session, test_user, story):
    db_session.add(_call(test_user.id, story.id))
    db_session.commit()
    assert "job_id" not in db_session.query(ActivityLog).one().metadata_


def test_a_job_opens_onto_the_calls_it_made(client, db_session, test_user, story):
    job = _run_two_call_job(db_session, test_user, story)
    db_session.add(_call(test_user.id, story.id, description="unrelated"))
    db_session.commit()

    rows = client.get(f"/api/jobs/{job.id}/activity").json()
    assert len(rows) == 3
    assert {r["metadata_"].get("status") for r in rows if r["category"] == "ai"} == {"ok", "error"}
    assert client.get(f"/api/jobs/{job.id}").json()["params"] == {}


def test_a_jobs_activity_belongs_to_its_owner(client, db_session, test_user):
    from app.auth.utils import hash_password
    from app.models.user import User

    stranger = User(id="stranger", username="stranger", password_hash=hash_password("x"), display_name="S", settings={})
    db_session.add(stranger)
    db_session.flush()
    other = AIJob(user_id=stranger.id, kind="scene-summaries", label="Not yours")
    db_session.add(other)
    db_session.commit()
    assert client.get(f"/api/jobs/{other.id}/activity").status_code == 404


def test_the_timeline_shows_a_job_once_with_its_calls_inside(client, db_session, test_user, story):
    job = _run_two_call_job(db_session, test_user, story)
    db_session.add(_call(test_user.id, story.id, description="a lone call"))
    db_session.commit()

    body = client.get(f"/api/chronicle/timeline?story_id={story.id}").json()
    assert body["total"] == 2
    kinds = {e["type"]: e for e in body["entries"]}
    assert kinds["job"]["job"]["id"] == job.id
    assert kinds["job"]["call_count"] == 2
    assert kinds["log"]["log"]["description"] == "a lone call"


def test_problems_finds_a_failed_call_inside_a_finished_job(client, db_session, test_user, story):
    """The job finished; one of its calls did not. "Problems" must still find that call."""
    job = _run_two_call_job(db_session, test_user, story)
    assert job.status == "done"

    entries = client.get(f"/api/chronicle/timeline?story_id={story.id}&problems=true").json()["entries"]
    assert [e["type"] for e in entries] == ["log"]
    assert entries[0]["log"]["metadata_"]["job_id"] == job.id


def test_problems_includes_failed_jobs(client, db_session, test_user, story):
    db_session.add(AIJob(user_id=test_user.id, story_id=story.id, kind="x", label="Broke", status="error"))
    db_session.add(AIJob(user_id=test_user.id, story_id=story.id, kind="x", label="Fine", status="done"))
    db_session.commit()
    entries = client.get(f"/api/chronicle/timeline?story_id={story.id}&problems=true").json()["entries"]
    assert [e["job"]["label"] for e in entries] == ["Broke"]


def test_results_and_starred_are_calls_only(client, db_session, test_user, story):
    _run_two_call_job(db_session, test_user, story)
    db_session.add(_call(test_user.id, story.id, feature="what-if", starred=True))
    db_session.commit()

    results = client.get(f"/api/chronicle/timeline?story_id={story.id}&results=true").json()["entries"]
    assert {e["type"] for e in results} == {"log"}
    assert all(e["log"]["metadata_"]["feature"] == "scene-summary" for e in results)

    starred = client.get(f"/api/chronicle/timeline?story_id={story.id}&starred=true").json()["entries"]
    assert [e["log"]["metadata_"]["feature"] for e in starred] == ["what-if"]


def test_writer_mode_sees_no_ai_rows_or_jobs(client, db_session, test_user, story):
    _run_two_call_job(db_session, test_user, story)
    db_session.add(
        ActivityLog(user_id=test_user.id, story_id=story.id, event_type="nlp", category="health", description="NLP")
    )
    db_session.commit()
    entries = client.get(f"/api/chronicle/timeline?story_id={story.id}&exclude_ai=true").json()["entries"]
    assert [e["log"]["description"] for e in entries] == ["NLP"]


def test_text_search_matches_calls_and_job_labels(client, db_session, test_user, story):
    _run_two_call_job(db_session, test_user, story)
    db_session.add(_call(test_user.id, story.id, description="lighthouse keeper"))
    db_session.commit()
    by_desc = client.get(f"/api/chronicle/timeline?story_id={story.id}&q=keeper").json()["entries"]
    assert [e["log"]["description"] for e in by_desc] == ["lighthouse keeper"]
    by_label = client.get(f"/api/chronicle/timeline?story_id={story.id}&q=two").json()["entries"]
    assert [e["job"]["label"] for e in by_label] == ["Two calls"]


def test_pages_interleave_both_sources_in_order(client, db_session, test_user, story):
    """Offset pagination across two tables: every row once, newest first, page by page."""
    start = datetime(2026, 9, 1)
    for i in range(5):
        at = start + timedelta(minutes=2 * i)
        db_session.add(_call(test_user.id, story.id, description=f"call {i}", created_at=at))
        db_session.add(
            AIJob(
                user_id=test_user.id,
                story_id=story.id,
                kind="x",
                label=f"job {i}",
                status="done",
                created_at=at + timedelta(minutes=1),
            )
        )
    db_session.commit()

    seen = []
    for page in (1, 2, 3, 4):
        body = client.get(f"/api/chronicle/timeline?story_id={story.id}&page={page}&page_size=3").json()
        assert body["total"] == 10
        seen += [e["at"] for e in body["entries"]]
    assert len(seen) == 10
    assert seen == sorted(seen, reverse=True)


def test_one_activity_row_opens_by_id_for_its_owner_only(client, db_session, test_user, story):
    from app.auth.utils import hash_password
    from app.models.user import User

    stranger = User(id="stranger", username="stranger", password_hash=hash_password("x"), display_name="S", settings={})
    db_session.add(stranger)
    db_session.flush()
    mine = _call(test_user.id, story.id, description="mine")
    theirs = _call(stranger.id, None, description="theirs")
    db_session.add_all([mine, theirs])
    db_session.commit()
    assert client.get(f"/api/chronicle/activity/{mine.id}").json()["description"] == "mine"
    assert client.get(f"/api/chronicle/activity/{theirs.id}").status_code == 404
