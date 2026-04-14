"""
Database fixtures for router integration tests.

Uses an in-memory SQLite database per test with all models registered.
StaticPool is required so all SQLAlchemy sessions share the same in-memory connection.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Import all models so SQLAlchemy registers every table in Base.metadata
import app.models  # noqa: F401 — side-effect import to register all ORM tables
from app.database import Base


def make_test_engine():
    """
    In-memory SQLite with StaticPool — all connections use the same underlying
    connection so CREATE TABLE in one place is visible everywhere.
    """
    return create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def make_test_session(engine) -> Session:
    Base.metadata.create_all(engine)
    return Session(engine)
