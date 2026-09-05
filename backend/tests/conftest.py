import sys
import types
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# weasyprint requires system graphics libraries (libgobject etc.) not available in all environments.
# Mock it out before importing app.main so that the export router can be imported without error.
_weasyprint_mock = MagicMock()
sys.modules.setdefault("weasyprint", _weasyprint_mock)
sys.modules.setdefault("weasyprint.HTML", _weasyprint_mock)

from app.main import app
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.utils import create_access_token
from app.models.user import User
from tests.fixtures.db_fixtures import make_test_engine, make_test_session
from tests.fixtures.ai_fixtures import make_mock_gateway, MockAIGateway


# ---------------------------------------------------------------------------
# Simple factory fixture (existing)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_thread():
    """Factory for PlotThread-like objects for testing validation logic."""
    def _make(
        id: str,
        name: str,
        mice_type: str = None,
        opens_at: str = None,
        closes_at: str = None,
    ):
        return SimpleNamespace(
            id=id,
            name=name,
            mice_type=mice_type,
            opens_at_node_id=opens_at,
            closes_at_node_id=closes_at,
        )

    return _make


# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session():
    """Isolated in-memory SQLite session for a single test."""
    engine = make_test_engine()
    session = make_test_session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def test_user(db_session: Session) -> User:
    """A persisted test user, ready for use in router tests."""
    from app.auth.utils import hash_password
    user = User(
        id=str(uuid.uuid4()),
        username="testuser",
        password_hash=hash_password("testpass"),
        display_name="Test User",
        is_admin=False,
        settings={},
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: User) -> str:
    """Valid JWT token for test_user."""
    return create_access_token(test_user.id)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Authorization header dict for use with TestClient."""
    return {"Authorization": f"Bearer {auth_token}"}


# ---------------------------------------------------------------------------
# TestClient fixture with dependency overrides
# ---------------------------------------------------------------------------

@pytest.fixture
def client(db_session: Session, test_user: User):
    """
    FastAPI TestClient with:
    - get_db overridden to use isolated in-memory SQLite session
    - get_current_user overridden to return the test user directly
    """
    def override_get_db():
        yield db_session

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    # No `with`: the lifespan (migrations, seeding, nightly backup) targets the
    # real data/ directory and has no business running inside a unit test.
    yield TestClient(app, raise_server_exceptions=True)

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# AI gateway mock fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_ai_gateway(monkeypatch):
    """
    Factory fixture that patches ai_gateway in all routers with a MockAIGateway.

    Usage:
        def test_something(mock_ai_gateway):
            gateway = mock_ai_gateway()  # default: streams SAMPLE_STREAM_TEXT
            # or
            gateway = mock_ai_gateway(structured_data={"suggestions": [...]})
            # or
            gateway = mock_ai_gateway(should_fail=True)

    Returns the MockAIGateway so tests can inspect .stream_calls / .structured_calls.
    """
    created: list[MockAIGateway] = []

    def _factory(
        *,
        stream_text: str | None = None,
        structured_data: dict | None = None,
        should_fail: bool = False,
        error_message: str = "Mock AI error",
    ) -> MockAIGateway:
        from tests.fixtures.ai_fixtures import SAMPLE_STREAM_TEXT
        gw = make_mock_gateway(
            stream_text=stream_text if stream_text is not None else SAMPLE_STREAM_TEXT,
            structured_data=structured_data,
            should_fail=should_fail,
            error_message=error_message,
        )
        created.append(gw)

        # Patch every router module that imports ai_gateway. Discovered, not
        # listed: a hand-written list once missed app.routers.editorial and the
        # "mocked" test spent 68 seconds waiting on a real Ollama.
        for module_name, module in list(sys.modules.items()):
            if module_name.startswith("app.routers.") and hasattr(module, "ai_gateway"):
                monkeypatch.setattr(module, "ai_gateway", gw)

        return gw

    return _factory
