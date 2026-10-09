"""Run Alembic migrations at startup, adopting databases created by older versions.

Three situations, see docs/upgrading.md:

- ``fresh``    no tables at all: run the migration chain from the baseline.
- ``adopted``  tables exist but the database was created by ``create_all`` (no
               ``alembic_version``) or stamped by the retired pre-2026.09 chain:
               create any missing tables, stamp at head. Nothing is dropped.
- ``upgraded`` / ``current``: a database already on this chain. Before an upgrade changes
               anything, a copy of the database goes to the backups folder.

A database migrated by a newer LoreStudio (a revision on this chain that this version does not
know) is refused: stamping it back would make the newer version replay its own migrations.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from alembic import command

from ..database import Base
from .db_backup import backup_before_upgrade

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
#: Revisions on this chain are numbered ("0037_conversation_thinking"); the retired chain's were hex.
_CHAIN_REVISION = re.compile(r"^\d{4}_")


class NewerDatabaseError(RuntimeError):
    """The database was migrated by a newer LoreStudio than this one."""


def _alembic_config(connection) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["connection"] = connection
    return cfg


def run_migrations(engine: Engine) -> str:
    """Bring ``engine`` to the current schema. Returns the mode used."""
    with engine.connect() as conn:
        cfg = _alembic_config(conn)
        script = ScriptDirectory.from_config(cfg)
        known = {rev.revision for rev in script.walk_revisions()}
        heads = set(script.get_heads())

        current = set(MigrationContext.configure(conn).get_current_heads())
        tables = set(inspect(conn).get_table_names()) - {"alembic_version"}
        unknown = current - known
        if unknown and all(_CHAIN_REVISION.match(r) for r in unknown):
            raise NewerDatabaseError(
                f"This database was last opened by a newer LoreStudio (schema {', '.join(sorted(unknown))}); "
                f"this version knows up to {', '.join(sorted(heads))}. Install that version or newer. "
                "Nothing was changed."
            )

        if not current and not tables:
            mode = "fresh"
            command.upgrade(cfg, "head")
        elif not current or unknown:
            mode = "adopted"
            Base.metadata.create_all(bind=conn)
            command.stamp(cfg, "head", purge=True)
        elif current == heads:
            mode = "current"
        else:
            mode = "upgraded"
            backup_before_upgrade(engine, "+".join(sorted(current)))
            command.upgrade(cfg, "head")
        conn.commit()
    logger.info("migrations: %s", mode)
    return mode
