import pytest
from types import SimpleNamespace


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
