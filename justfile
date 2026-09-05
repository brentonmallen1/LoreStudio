# LoreStudio — Task Runner
# Requires: just (https://github.com/casey/just)

# Default: list all recipes
default:
    @just --list

# ── Setup ──────────────────────────────────────
# Install all dependencies
setup: setup-backend setup-frontend

setup-backend:
    cd backend && uv sync --all-groups

setup-frontend:
    cd frontend && npm install

# ── Development ────────────────────────────────
# Start both backend and frontend concurrently
dev:
    #!/bin/bash
    trap 'kill 0' EXIT
    just backend &
    just frontend &
    wait

backend:
    cd backend && DYLD_LIBRARY_PATH=/opt/homebrew/lib uv run uvicorn app.main:app --reload --reload-exclude '.venv' --host 0.0.0.0 --port 8000

frontend:
    cd frontend && npm run dev

# ── Database ───────────────────────────────────
# Run all pending migrations
db-migrate:
    cd backend && uv run python -m alembic upgrade head

# Create a new migration (usage: just db-revision "add thing")
db-revision name:
    cd backend && uv run python -m alembic revision --autogenerate -m "{{name}}"

# Check that models and migrations agree (what CI runs)
db-check:
    cd backend && uv run python -m alembic check

# Reset database (destructive!). Migrations run on next backend start.
db-reset:
    rm -f backend/data/lorestudio.db backend/data/lorestudio.db-wal backend/data/lorestudio.db-shm

# ── Docker ─────────────────────────────────────
build:
    docker compose build

up:
    docker compose up -d

down:
    docker compose down

logs:
    docker compose logs -f

restart:
    docker compose restart

# ── Quality gates ──────────────────────────────
# Exactly what GitHub CI runs (.github/workflows/ci.yml), locally. Run before pushing.
ci:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "── file-length budget ──"     && python3 scripts/check-size.py
    echo "── backend: ruff ──"          && (cd backend && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/)
    echo "── backend: ty ──"            && (cd backend && uv run ty check app/)
    echo "── backend: pytest ──"        && (cd backend && uv run python -m pytest -q --cov)
    echo "── backend: migrations ──"    && (cd backend && uv run python -m pytest -q tests/test_migrations.py)
    echo "── frontend: prettier ──"     && (cd frontend && npm run format:check)
    echo "── frontend: tsc ──"          && (cd frontend && npm run typecheck)
    echo "── frontend: eslint ──"       && (cd frontend && npm run lint)
    echo "── frontend: vitest ──"       && (cd frontend && npm run test:coverage)
    echo "── frontend: build ──"        && (cd frontend && npm run build)
    echo "✓ ci green"

# Lint everything (no tests)
lint:
    cd backend && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/
    cd frontend && npm run lint && npm run format:check

# Auto-fix what can be fixed, then format
fix:
    cd backend && uv run ruff check --fix app/ tests/ && uv run ruff format app/ tests/
    cd frontend && npx eslint . --fix; npm run format

typecheck:
    cd backend && uv run ty check app/
    cd frontend && npm run typecheck

# File-length budget (`just check-size --update` reprints the debt list)
check-size *ARGS:
    python3 scripts/check-size.py {{ARGS}}

# Install the git pre-commit hook (scripts/pre-commit)
hooks:
    #!/usr/bin/env bash
    set -euo pipefail
    hook="$(git rev-parse --git-path hooks/pre-commit)"
    ln -sf "$(git rev-parse --show-toplevel)/scripts/pre-commit" "$hook"
    echo "installed $hook -> scripts/pre-commit (bypass once with git commit --no-verify)"

# ── Testing ────────────────────────────────────
# `python -m pytest` rather than `uv run pytest`: robust to a moved venv.
test:
    cd backend && uv run python -m pytest -v

test-watch:
    cd backend && uv run python -m pytest -v --tb=short -f

test-frontend:
    cd frontend && npm test

# ── Utilities ──────────────────────────────────
# Copy .env.example to .env if it doesn't exist
init-env:
    cp -n .env.example .env && echo ".env created" || echo ".env already exists"

# Show running services
status:
    docker compose ps
