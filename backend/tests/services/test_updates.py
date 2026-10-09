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


def test_the_status_endpoint_answers_without_asking_github(client, monkeypatch):
    async def never():
        raise AssertionError("status must not call GitHub")

    monkeypatch.setattr(updates, "fetch_latest", never)
    body = client.get("/api/system/update").json()
    assert set(body) >= {"current", "latest", "available", "install", "automatic"}
    assert body["install"] == "source"
