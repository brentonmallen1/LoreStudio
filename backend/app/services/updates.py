"""Is there a newer LoreStudio? (Settings › About and updates, the logo menu.)

The check asks GitHub for the latest release and keeps the answer in app_settings. It runs
when the author asks (Check now) or, if they switch it on, once a day as automatic work
(services/automatic.py, "update-check", off by default). It sends nothing about the author or
their stories: GitHub sees one request, with LoreStudio's version as the user agent.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..models.app_setting import AppSetting

REPOSITORY = "brentonmallen1/LoreStudio"
LATEST_RELEASE = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
STATE_KEY = "update_check"
#: How to update, by how LoreStudio was installed (INSTALL_KIND, set by the images).
INSTALL_KINDS = ("docker", "desktop", "source")

_CALVER = re.compile(r"^v?(\d{4})\.(\d{1,2})\.(\d+)$")


def parse_version(version: str | None) -> tuple[int, int, int] | None:
    """`2026.10.3` or `v2026.10.3` → (2026, 10, 3); anything else (`dev`) → None."""
    m = _CALVER.match((version or "").strip())
    return (int(m[1]), int(m[2]), int(m[3])) if m else None


def is_newer(latest: str | None, current: str | None) -> bool:
    """A release is news only to a released version: a development build never "needs" one."""
    a, b = parse_version(latest), parse_version(current)
    return a is not None and b is not None and a > b


def _read(db: Session) -> dict[str, Any]:
    row = db.get(AppSetting, STATE_KEY)
    return dict(row.value or {}) if row else {}


def _write(db: Session, value: dict[str, Any]) -> None:
    row = db.get(AppSetting, STATE_KEY)
    if row is None:
        row = AppSetting(key=STATE_KEY, value={})
        db.add(row)
    row.value = value
    db.commit()


async def fetch_latest() -> dict[str, Any]:
    """The latest release on GitHub: its version, page and date."""
    headers = {"Accept": "application/vnd.github+json", "User-Agent": f"LoreStudio/{settings.app_version}"}
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(LATEST_RELEASE, headers=headers)
    res.raise_for_status()
    data = res.json()
    return {
        "latest": str(data.get("tag_name", "")).removeprefix("v"),
        "url": data.get("html_url"),
        "published_at": data.get("published_at"),
    }


async def check(db: Session) -> dict[str, Any]:
    """Ask GitHub now and keep the answer (or why there is none). Returns the status."""
    now = datetime.now(UTC).replace(tzinfo=None).isoformat()
    previous = _read(db)
    try:
        found = await fetch_latest()
        _write(db, {**found, "checked_at": now, "error": None})
    except (httpx.HTTPError, ValueError) as exc:
        # Keep the last answer; say why this one failed.
        _write(db, {**previous, "checked_at": now, "error": f"GitHub did not answer: {exc}"[:300]})
    return status(db)


def status(db: Session) -> dict[str, Any]:
    from . import automatic

    state = _read(db)
    latest = state.get("latest")
    install = settings.install_kind if settings.install_kind in INSTALL_KINDS else "source"
    return {
        "current": settings.app_version,
        "latest": latest,
        "available": is_newer(latest, settings.app_version),
        "url": state.get("url"),
        "published_at": state.get("published_at"),
        "checked_at": state.get("checked_at"),
        "error": state.get("error"),
        "install": install,
        "automatic": automatic.task_settings(db, "update-check")["enabled"],
    }


def summary(found: dict[str, Any]) -> str:
    """One line for Automatic work's "last ran"."""
    if found.get("error"):
        return found["error"]
    if found.get("available"):
        return f"LoreStudio {found['latest']} is available"
    return f"Up to date ({found.get('latest') or 'no release found'})"
