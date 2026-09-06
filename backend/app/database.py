import sqlite3

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session

from .config import settings


@event.listens_for(Engine, "connect")
def _configure_sqlite(dbapi_conn, _record) -> None:
    """Per-connection SQLite settings, applied to every engine in the process.

    - foreign_keys: SQLite ignores ON DELETE clauses unless this is on. Without it
      every ``ondelete="CASCADE"`` in the models is inert and story deletion
      leaves orphan rows.
    - journal_mode=WAL: readers no longer block the single writer (a no-op for
      in-memory databases).
    - busy_timeout: wait instead of failing when the writer holds the lock.
    """
    if not isinstance(dbapi_conn, sqlite3.Connection):
        return
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.close()
    _load_sqlite_vec(dbapi_conn)


#: Whether sqlite-vec's distance functions are available on connections from this process.
#: The Codex index works either way — this only decides whether the similarity search runs
#: in C or in Python (``services/codex/embeddings.py``).
VEC_LOADED: bool = False


def _load_sqlite_vec(conn: sqlite3.Connection) -> None:
    """Load sqlite-vec if this Python's sqlite3 will have it.

    Extension loading is compiled out of some SQLite builds, and the wheel does not cover
    every platform. Neither is a failure worth an error: the semantic index falls back to
    computing cosine distance in Python, which for one story is a few milliseconds.
    """
    global VEC_LOADED
    if not hasattr(conn, "enable_load_extension"):
        return
    try:
        import sqlite_vec

        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        VEC_LOADED = True
    except Exception:  # pragma: no cover - platform dependent
        VEC_LOADED = False
    finally:
        try:
            conn.enable_load_extension(False)
        except Exception:  # pragma: no cover - platform dependent
            pass


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


def get_db():
    with Session(engine) as session:
        yield session
