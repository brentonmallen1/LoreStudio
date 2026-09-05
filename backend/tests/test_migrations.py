"""Migrations: the chain builds the same schema as the models, and startup adopts old databases."""

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.services.db_migrate import run_migrations


def _engine(tmp_path, name):
    return create_engine(
        f"sqlite:///{tmp_path / name}", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


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


def _insert(conn, table_name: str, **values):
    """Insert a row at whatever schema revision the connection is on, filling
    NOT NULL columns that have no default with type-appropriate placeholders."""
    import sqlalchemy as sa

    md = sa.MetaData()
    table = sa.Table(table_name, md, autoload_with=conn)
    row = dict(values)
    for col in table.columns:
        if col.name in row or col.nullable or col.server_default is not None or col.primary_key:
            continue
        t = col.type
        if isinstance(t, sa.Boolean):
            row[col.name] = False
        elif isinstance(t, (sa.Integer, sa.Float)):
            row[col.name] = 0
        elif isinstance(t, sa.DateTime):
            row[col.name] = __import__("datetime").datetime.now()
        elif isinstance(t, sa.JSON):
            row[col.name] = {}
        else:
            row[col.name] = ""
    conn.execute(table.insert().values(**row))


def test_0002_copies_purpose_and_notes_out_of_metadata(tmp_path):
    from alembic.config import Config

    from alembic import command
    from app.services.db_migrate import BACKEND_DIR

    engine = _engine(tmp_path, "upgrade.db")
    with engine.connect() as conn:
        cfg = Config(str(BACKEND_DIR / "alembic.ini"))
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "0001_baseline")
        _insert(conn, "users", id="u", username="u", password_hash="x", display_name="U", is_admin=True, settings={})
        _insert(conn, "stories", id="s", user_id="u", title="T")
        _insert(
            conn,
            "structure_nodes",
            id="n",
            story_id="s",
            title="Lamp",
            level=0,
            level_type="scene",
            position=0,
            metadata={"purpose": "setup", "inline_notes": [{"id": "n1", "note": "keep"}], "mice_opens": "q"},
        )
        conn.commit()
        command.upgrade(cfg, "head")
        row = conn.execute(text("SELECT purpose, inline_notes, metadata FROM structure_nodes WHERE id='n'")).one()
    assert row[0] == "setup"
    assert "keep" in row[1]
    assert "purpose" not in row[2] and "mice_opens" in row[2]
