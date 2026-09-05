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


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


def get_db():
    with Session(engine) as session:
        yield session
