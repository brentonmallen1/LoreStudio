"""First run (doc 30 D4): a new account is asked once whether it wants the Assistant; an account
from before is never asked. The "Set up the Assistant" card checks Ollama without waking a model."""

from app.routers import ollama as ollama_router
from app.services.first_run import new_account_settings


def test_a_new_account_is_asked(client, test_user, db_session):
    test_user.is_admin = True
    db_session.commit()
    r = client.post("/api/users", json={"username": "new", "password": "pw", "display_name": "New"})
    assert r.status_code == 201, r.text
    assert r.json()["settings"]["ui"]["welcome"] == "ask"


def test_an_account_from_before_is_never_asked(client):
    me = client.get("/api/auth/me").json()
    assert "welcome" not in (me["settings"].get("ui") or {})


def test_the_answer_keeps_the_rest_of_ui(client, test_user, db_session):
    test_user.settings = new_account_settings()
    db_session.commit()
    me = client.patch("/api/auth/me", json={"settings": {"ui": {"mode": "writer", "welcome": "done"}}}).json()
    assert me["settings"]["ui"] == {"mode": "writer", "welcome": "done"}
    me = client.patch("/api/auth/me", json={"settings": {"ui": {"start_here": "done"}}}).json()
    assert me["settings"]["ui"] == {"mode": "writer", "welcome": "done", "start_here": "done"}


def _ollama(monkeypatch, *, up: bool, listed: bool):
    calls = {"ping": 0}

    async def is_available(base_url=None):
        return up

    async def model_exists(model, base_url=None):
        return listed

    async def ping_model(model, base_url=None):
        calls["ping"] += 1
        return True, ""

    p = ollama_router.ollama_provider
    monkeypatch.setattr(p, "is_available", is_available)
    monkeypatch.setattr(p, "model_exists", model_exists)
    monkeypatch.setattr(p, "ping_model", ping_model)
    return calls


def test_a_quick_check_never_wakes_the_model(client, monkeypatch):
    calls = _ollama(monkeypatch, up=True, listed=True)
    got = client.get("/api/ollama/status?quick=true").json()
    assert got["connected"] and got["model_in_list"] and got["model_available"]
    assert calls["ping"] == 0
    client.get("/api/ollama/status")
    assert calls["ping"] == 1


def test_a_quick_check_says_what_is_missing(client, monkeypatch):
    _ollama(monkeypatch, up=False, listed=False)
    got = client.get("/api/ollama/status?quick=true").json()
    assert not got["connected"] and not got["model_available"]
    _ollama(monkeypatch, up=True, listed=False)
    got = client.get("/api/ollama/status?quick=true").json()
    assert got["connected"] and not got["model_in_list"] and "ollama pull" in got["error"]
