"""
Scene summaries pause for a model that is not there (doc 21 follow-up).

The job used to count each scene as failed and carry on, so with Ollama stopped a whole
manuscript ended "31 failed". Now it pauses the lane like any model job, and coming back it
does only the scenes still to do. The inline endpoint still counts failures.
"""

import uuid

import anyio

from app.models.story import Story
from app.models.structure import StructureNode
from app.services import scene_summaries
from app.services.job_queue import _claim_next, enqueue, run_job
from app.services.scene_summaries import refresh_scene_summaries


def _story(db, user) -> Story:
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    for i, title in enumerate(("The Barometer", "Knock at the Door", "The Logbook")):
        db.add(
            StructureNode(
                id=str(uuid.uuid4()),
                story_id=story.id,
                title=title,
                level=0,
                level_type="scene",
                position=i,
                content=f"<p>{title}: Eleanor at the lamp.</p>",
            )
        )
    db.commit()
    return story


def _model(monkeypatch, *, answers_until: int):
    """A model that summarises `answers_until` scenes, then stops answering."""
    calls = {"n": 0}

    async def stream(**_kw):
        calls["n"] += 1
        if calls["n"] > answers_until:
            raise RuntimeError("Error reaching LLM: [Errno 61] Connection refused")
        yield "Eleanor keeps the light."

    monkeypatch.setattr(scene_summaries.ai_gateway, "stream", stream)


def test_the_job_pauses_and_comes_back_to_the_rest(db_session, test_user, monkeypatch):
    story = _story(db_session, test_user)
    _model(monkeypatch, answers_until=1)
    job = enqueue(db_session, kind="scene-summaries", user_id=test_user.id, story_id=story.id, label="Summaries")

    anyio.run(run_job, _claim_next(db_session, "model"), db_session)
    db_session.refresh(job)
    assert job.status == "queued" and job.step_label == "Paused: the model is not answering."
    done = [n.title for n in db_session.query(StructureNode).filter(StructureNode.content_summary != "")]
    assert done == ["The Barometer"]

    _model(monkeypatch, answers_until=99)
    anyio.run(run_job, _claim_next(db_session, "model"), db_session)
    db_session.refresh(job)
    assert job.status == "done"
    assert job.result["summarized_count"] == 2 and job.result["failed_count"] == 0


def test_the_inline_endpoint_still_counts_failures(db_session, test_user, monkeypatch):
    story = _story(db_session, test_user)
    _model(monkeypatch, answers_until=0)
    counts = anyio.run(lambda: refresh_scene_summaries(story.id, db_session, test_user))
    assert counts["failed_count"] == 3
