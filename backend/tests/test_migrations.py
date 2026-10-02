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
        row = conn.execute(text("SELECT purpose, metadata FROM structure_nodes WHERE id='n'")).one()
        # 0023: the margin note is a row now, under its own id (the prose's mark names it).
        note = conn.execute(text("SELECT id, kind, content, node_id, story_id FROM notes")).one()
    assert row[0] == "setup"
    assert "purpose" not in row[1] and "mice_opens" in row[1]
    assert tuple(note) == ("n1", "note", "keep", "n", "s")


def _migration_0016():
    import importlib.util

    from app.services.db_migrate import BACKEND_DIR

    path = BACKEND_DIR / "alembic" / "versions" / "0016_planning_fields.py"
    spec = importlib.util.spec_from_file_location("m0016", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_0016_splits_a_labelled_summary_and_keeps_free_text_whole():
    m = _migration_0016()
    assert m.split_gmc("Goal: find James. Motivation: grief. Conflict: the keeper lies. Epiphany: let go.") == {
        "goal": "Find James.",
        "motivation": "Grief.",
        "conflict": "The keeper lies.",
        "epiphany": "Let go.",
    }
    # A label mid-sentence is not a structure.
    assert m.split_gmc("She wants peace; the conflict: her father.") is None

    fields = {"mission_statement": "To know her father.", "motivation": "", "arc_notes": "Opens up."}
    updates = m.place_summary("Goal: keep the light. Motivation: guilt. Conflict: the stranger.", fields)
    assert updates["motivation"] == "Guilt."
    assert updates["conflict"] == "The stranger."
    assert "mission_statement" not in updates  # already written; the different goal goes to arc notes
    assert updates["arc_notes"] == "Opens up.\n\nFrom the Snowflake summary:\nGoal: Keep the light."
    assert m.place_summary("  ", fields) == {}


def test_0016_moves_snowflake_text_into_the_shared_fields(tmp_path):
    from alembic.config import Config

    from alembic import command
    from app.services.db_migrate import BACKEND_DIR

    engine = _engine(tmp_path, "planning.db")
    with engine.connect() as conn:
        cfg = Config(str(BACKEND_DIR / "alembic.ini"))
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "0015_character_flaws_quirks_speech")
        _insert(conn, "users", id="u", username="u", password_hash="x", display_name="U", is_admin=True, settings={})
        _insert(conn, "stories", id="a", user_id="u", title="A", snowflake_sentence="One line.", logline="")
        _insert(
            conn,
            "stories",
            id="b",
            user_id="u",
            title="B",
            logline="Kept.",
            snowflake_sentence="Different.",
            snowflake_paragraph="Five sentences.",
            snowflake_synopsis="A page.",
        )
        _insert(
            conn,
            "characters",
            id="c",
            story_id="b",
            name="Eleanor",
            snowflake_summary="Just prose about her.",
            snowflake_synopsis="I came back.",
        )
        conn.commit()
        command.upgrade(cfg, "head")
        stories = dict(conn.execute(text("SELECT id, logline FROM stories")).all())
        b = conn.execute(text("SELECT paragraph_summary, synopsis FROM stories WHERE id='b'")).one()
        # 0023 turned the old story note into an idea
        note = conn.execute(text("SELECT story_id, content FROM notes WHERE kind = 'idea'")).one()
        c = conn.execute(text("SELECT arc_notes, arc_in_own_words, conflict FROM characters")).one()
    assert stories == {"a": "One line.", "b": "Kept."}
    assert tuple(b) == ("Five sentences.", "A page.")
    assert note[0] == "b" and "Different." in note[1]
    assert c[0] == "From the Snowflake summary:\nJust prose about her."
    assert c[1] == "I came back."
    assert c[2] == ""


def test_0024_turns_unsorted_ideas_into_notes(tmp_path):
    from alembic.config import Config

    from alembic import command
    from app.services.db_migrate import BACKEND_DIR

    engine = _engine(tmp_path, "ideas.db")
    with engine.connect() as conn:
        cfg = Config(str(BACKEND_DIR / "alembic.ini"))
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "0023_notes")
        _insert(conn, "users", id="u", username="u", password_hash="x", display_name="U", is_admin=True, settings={})
        pieces = [
            {"id": "f1", "text": "A keeper who stayed.", "created_at": "2026-09-01T09:00:00", "filed": None},
            {"id": "f2", "text": "Calder", "created_at": "2026-09-01", "filed": {"kind": "character"}},
            {"id": "f3", "text": "  ", "filed": None},
        ]
        _insert(conn, "stories", id="s", user_id="u", title="T", idea_fragments=pieces)
        conn.commit()
        command.upgrade(cfg, "head")
        ideas = conn.execute(text("SELECT id, kind, content, story_id FROM notes")).all()
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(stories)"))]
    assert [tuple(r) for r in ideas] == [("f1", "idea", "A keeper who stayed.", "s")]
    assert "freewrite" in cols and "idea_fragments" not in cols
