"""Integration tests for GET /stories/{id}/health endpoint.

TODO: Add TestClient fixture to conftest.py and implement:
- test_health_returns_word_count_target — story with intended_length returns target block
- test_health_returns_mice_violations — crossing threads appear in violations list
- test_health_returns_empty_violations_when_valid — proper nesting returns []
- test_health_requires_auth — unauthenticated request returns 401
"""
