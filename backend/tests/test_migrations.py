"""Migrations: the chain builds the same schema as the models, and startup adopts old databases."""

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.services.db_migrate import run_migrations


def _engine(tmp_path, name):
    return create_engine(f"sqlite:///{tmp_path / name}", connect_args={"check_same_thread": False}, poolclass=StaticPool)


def _head(engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_database_runs_chain_and_matches_models(tmp_path):
    engine = _engine(tmp_path, "fresh.db")
    assert run_migrations(engine) == "fresh"
    assert set(inspect(engine).get_table_names()) >= set(Base.metadata.tables)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], f"models drifted from migrations; add a revision: {diff}"
    assert run_migrations(engine) == "current"


def test_create_all_database_is_adopted(tmp_path):
    engine = _engine(tmp_path, "legacy.db")
    Base.metadata.create_all(engine)
    assert run_migrations(engine) == "adopted"
    assert _head(engine) is not None
    assert run_migrations(engine) == "current"


def test_old_chain_stamp_is_adopted(tmp_path):
    engine = _engine(tmp_path, "oldchain.db")
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(text("INSERT INTO alembic_version VALUES ('17168dc53585')"))
    assert run_migrations(engine) == "adopted"
    assert _head(engine) != "17168dc53585"
