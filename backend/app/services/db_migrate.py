"""Run Alembic migrations at startup, adopting databases created by older versions.

Three situations, see docs/upgrading.md:

- ``fresh``    no tables at all: run the migration chain from the baseline.
- ``adopted``  tables exist but the database was created by ``create_all`` (no
               ``alembic_version``) or stamped by the retired pre-2026.09 chain:
               create any missing tables, stamp at head. Nothing is dropped.
- ``upgraded`` / ``current``: a database already on this chain.
"""

from __future__ import annotations

import logging
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from alembic import command

from ..database import Base

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]


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

        if not current and not tables:
            mode = "fresh"
            command.upgrade(cfg, "head")
        elif not current or not current <= known:
            mode = "adopted"
            Base.metadata.create_all(bind=conn)
            command.stamp(cfg, "head", purge=True)
        elif current == heads:
            mode = "current"
        else:
            mode = "upgraded"
            command.upgrade(cfg, "head")
        conn.commit()
    logger.info("migrations: %s", mode)
    return mode
