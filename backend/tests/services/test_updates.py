import httpx
import pytest

from app.services import automatic, updates


def test_versions_compare_as_calendar_versions():
    assert updates.parse_version("v2026.10.3") == (2026, 10, 3)
    assert updates.parse_version("2026.9.12") == (2026, 9, 12)
    assert updates.parse_version("dev") is None
    assert updates.is_newer("2026.10.4", "2026.10.3")
    assert updates.is_newer("2026.11.1", "2026.10.12")
    assert not updates.is_newer("2026.10.3", "2026.10.3")
    assert not updates.is_newer("2026.10.2", "2026.10.3")
    # A development build is never told it is behind.
    assert not updates.is_newer("2026.10.4", "dev")


def test_the_daily_check_is_off_until_switched_on(db_session):
    assert automatic.task_settings(db_session, "update-check")["enabled"] is False
    assert updates.status(db_session)["automatic"] is False


@pytest.mark.asyncio
async def test_a_check_keeps_the_answer_and_says_when_one_is_newer(db_session, monkeypatch):
    monkeypatch.setattr(updates.settings, "app_version", "2026.10.3")

    async def latest():
        return {"latest": "2026.10.4", "url": "https://example/r", "published_at": "2026-10-20T00:00:00Z"}

    monkeypatch.setattr(updates, "fetch_latest", latest)
    found = await updates.check(db_session)
    assert found["available"] and found["latest"] == "2026.10.4" and found["error"] is None
    assert updates.summary(found) == "LoreStudio 2026.10.4 is available"
    assert updates.status(db_session)["checked_at"] == found["checked_at"]


@pytest.mark.asyncio
async def test_a_failed_check_keeps_the_last_answer_and_says_why(db_session, monkeypatch):
    monkeypatch.setattr(updates.settings, "app_version", "2026.10.3")

    async def latest():
        return {"latest": "2026.10.4", "url": None, "published_at": None}

    async def offline():
        raise httpx.ConnectError("no network")

    monkeypatch.setattr(updates, "fetch_latest", latest)
    await updates.check(db_session)
    monkeypatch.setattr(updates, "fetch_latest", offline)
    found = await updates.check(db_session)
    assert found["latest"] == "2026.10.4" and found["available"]
    assert found["error"].startswith("GitHub did not answer")


@pytest.mark.asyncio
async def test_the_desktop_app_is_told_once_its_installers_are_on_the_release(db_session, monkeypatch):
    monkeypatch.setattr(updates.settings, "app_version", "2026.10.3")
    monkeypatch.setattr(updates.settings, "install_kind", "desktop")
    release = {"latest": "2026.10.4", "url": None, "published_at": None, "desktop_ready": False}

    async def latest():
        return release

    monkeypatch.setattr(updates, "fetch_latest", latest)
    assert not (await updates.check(db_session))["available"]
    release["desktop_ready"] = True
    assert (await updates.check(db_session))["available"]
    # Docker and source installs never wait for the desktop build.
    monkeypatch.setattr(updates.settings, "install_kind", "docker")
    release["desktop_ready"] = False
    assert (await updates.check(db_session))["available"]


@pytest.mark.asyncio
async def test_the_release_says_whether_latest_json_is_attached(monkeypatch):
    def answer(request):
        assets = [{"name": "LoreStudio_2026.10.4_macos-arm64.dmg"}, {"name": "latest.json"}]
        return httpx.Response(200, json={"tag_name": "v2026.10.4", "assets": assets})

    real = httpx.AsyncClient
    monkeypatch.setattr(updates.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(answer), **kw))
    found = await updates.fetch_latest()
    assert found["latest"] == "2026.10.4" and found["desktop_ready"]


def test_the_status_endpoint_answers_without_asking_github(client, monkeypatch):
    async def never():
        raise AssertionError("status must not call GitHub")

    monkeypatch.setattr(updates, "fetch_latest", never)
    body = client.get("/api/system/update").json()
    assert set(body) >= {"current", "latest", "available", "install", "automatic"}
    assert body["install"] == "source"
