"""Nightly SQLite backup with retention, plus status for the System settings page.

``VACUUM INTO`` writes a consistent copy of the live database without locking
writers for long. Files are named ``lorestudio-YYYYMMDD-HHMMSS-ffffff.db``.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

from ..config import settings

logger = logging.getLogger(__name__)

_NAME = re.compile(r"^lorestudio-(\d{8}-\d{6}-\d{6})\.db$")
INTERVAL_SECONDS = 24 * 60 * 60


def _is_sqlite(engine: Engine) -> bool:
    return engine.url.get_backend_name() == "sqlite" and engine.url.database not in (None, "", ":memory:")


def list_backups(backups_dir: Path | None = None) -> list[dict]:
    d = Path(backups_dir or settings.backups_path)
    if not d.is_dir():
        return []
    out = []
    for f in sorted(d.iterdir(), reverse=True):
        m = _NAME.match(f.name)
        if not m:
            continue
        out.append(
            {
                "filename": f.name,
                "created_at": datetime.strptime(m.group(1), "%Y%m%d-%H%M%S-%f").replace(tzinfo=UTC).isoformat(),
                "size_bytes": f.stat().st_size,
            }
        )
    return out


def create_backup(engine: Engine, backups_dir: Path | None = None, keep: int | None = None) -> Path | None:
    """Write one backup and prune old ones. Returns the path, or None for non-file databases."""
    if not _is_sqlite(engine):
        return None
    d = Path(backups_dir or settings.backups_path)
    d.mkdir(parents=True, exist_ok=True)
    target = d / f"lorestudio-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S-%f')}.db"
    with engine.connect() as conn:
        conn.execute(text("VACUUM INTO :path"), {"path": str(target)})
    keep = settings.db_backup_keep if keep is None else keep
    for old in [d / b["filename"] for b in list_backups(d)][keep:]:
        old.unlink(missing_ok=True)
    logger.info("db backup written: %s", target.name)
    return target


def backup_status(backups_dir: Path | None = None) -> dict:
    backups = list_backups(backups_dir)
    return {
        "enabled": settings.db_backup_enabled,
        "path": str(Path(backups_dir or settings.backups_path)),
        "keep": settings.db_backup_keep,
        "count": len(backups),
        "latest": backups[0] if backups else None,
    }


async def backup_loop(engine: Engine) -> None:
    """Run at start, then once a day. Cancelled with the app lifespan."""
    while True:
        try:
            await asyncio.to_thread(create_backup, engine)
        except Exception:  # pragma: no cover - never let a backup failure kill the app
            logger.exception("nightly db backup failed")
        await asyncio.sleep(INTERVAL_SECONDS)
