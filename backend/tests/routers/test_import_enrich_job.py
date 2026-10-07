"""
The import's AI reading as a job (doc 21 R8, D15).

It ran inside a request the import wizard held, behind its spinner: closing the wizard lost it.
Now it is a job before any story exists, with progress per call, that the wizard reads back.
"""

from types import SimpleNamespace

from app.routers import import_router
from app.routers.import_router import _ImportSession, _sessions
from tests.fixtures.jobs import run_queued

CANDIDATE = {
    "id": "c1",
    "name": "Eleanor",
    "entity_type": "character",
    "source": "nlp",
    "occurrences": 9,
    "scene_count": 3,
    "confidence": 0.9,
}


def _open_import(user_id: str) -> str:
    preview = SimpleNamespace(nodes=[], detected_title="The Lantern")
    _sessions["imp-1"] = _ImportSession("imp-1", user_id, [], preview)
    return "imp-1"


def test_the_reading_is_a_job_the_wizard_reads_back(client, db_session, test_user, monkeypatch):
    async def fake_extract(*, candidates, on_progress=None, **_kw):
        for i in range(1, 3):
            on_progress(i, 2)
        return [c.model_copy(update={"source": "ai"}) for c in candidates]

    monkeypatch.setattr(import_router, "extract_entities_ai", fake_extract)
    session_id = _open_import(test_user.id)
    assert client.get(f"/api/import/{session_id}").json() == {"alive": True}

    body = {"candidates": [CANDIDATE], "options": {"characters_ai": True}}
    queued = client.post(f"/api/import/{session_id}/enrich-candidates/jobs", json=body)
    assert queued.status_code == 201, queued.text
    job = queued.json()
    assert job["story_id"] is None and job["label"] == "Import: reading people and places in The Lantern"

    (done,) = run_queued(db_session, "model")
    assert done.status == "done" and (done.progress, done.total) == (2, 2)
    assert done.result["candidates"][0]["source"] == "ai"
    _sessions.pop(session_id, None)


def test_a_closed_import_says_so(client, db_session, test_user):
    session_id = _open_import(test_user.id)
    body = {"candidates": [CANDIDATE], "options": {"characters_ai": True}}
    client.post(f"/api/import/{session_id}/enrich-candidates/jobs", json=body)
    _sessions.pop(session_id)
    assert client.get(f"/api/import/{session_id}").status_code == 404

    (job,) = run_queued(db_session, "model")
    assert job.status == "error" and "Upload the document again" in job.error
