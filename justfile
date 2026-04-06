# LoreStudio — Task Runner
# Requires: just (https://github.com/casey/just)

# Default: list all recipes
default:
    @just --list

# ── Setup ──────────────────────────────────────
# Install all dependencies
setup: setup-backend setup-frontend

setup-backend:
    cd backend && uv sync

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
    cd backend && DYLD_LIBRARY_PATH=/opt/homebrew/lib uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
    cd frontend && npm run dev

# ── Database ───────────────────────────────────
# Run all pending migrations
db-migrate:
    cd backend && uv run alembic upgrade head

# Create a new migration (usage: just db-revision "add thing")
db-revision name:
    cd backend && uv run alembic revision --autogenerate -m "{{name}}"

# Reset database (destructive!)
db-reset:
    rm -f backend/data/lorestudio.db
    cd backend && PYTHONPATH=. uv run python scripts/reset_db.py
    cd backend && uv run alembic stamp head

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

# ── Testing ────────────────────────────────────
test:
    cd backend && uv run pytest -v

test-watch:
    cd backend && uv run pytest -v --tb=short -f

# ── Utilities ──────────────────────────────────
# Copy .env.example to .env if it doesn't exist
init-env:
    cp -n .env.example .env && echo ".env created" || echo ".env already exists"

# Show running services
status:
    docker compose ps
