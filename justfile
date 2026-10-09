# LoreStudio — Task Runner
# Requires: just (https://github.com/casey/just)

# Load PORT/FRONTEND_PORT/etc. from .env so `just dev` matches docker-compose.yml's ports.
set dotenv-load := true

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
    # `python -m uvicorn` rather than `uv run uvicorn`: robust to a moved venv (see justfile test recipes).
    cd backend && DYLD_LIBRARY_PATH=/opt/homebrew/lib uv run python -m uvicorn app.main:app --reload --reload-exclude '.venv' --host 0.0.0.0 --port "${PORT:-8000}"

frontend:
    cd frontend && npm run dev

# Force-free the dev ports if `just dev` left something running (`down` only stops Docker)
dev-stop:
    #!/usr/bin/env bash
    set -euo pipefail
    for port in "${PORT:-8000}" "${FRONTEND_PORT:-5173}"; do
      pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
      if [ -z "$pids" ]; then
        echo "port $port: already free"
        continue
      fi
      for pid in $pids; do
        owner="$(ps -o comm= -p "$pid" 2>/dev/null || echo unknown)"
        if [[ "$owner" == *docker* ]]; then
          echo "port $port: held by Docker ($owner, pid $pid) — probably a different project's container; run 'docker ps' to find it, then 'docker stop <name>'"
        else
          echo "port $port: killing $owner (pid $pid)"
          kill -9 "$pid"
        fi
      done
    done

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
# Two containers (docker-compose.yml): build the API and web images
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

# One container (Dockerfile.aio): build it as ghcr.io/brentonmallen1/lorestudio:dev
aio-build:
    docker build -f Dockerfile.aio --build-arg APP_VERSION=dev -t ghcr.io/brentonmallen1/lorestudio:dev .

# Run the all-in-one on WEB_PORT (8080) with ./data as /data (ADMIN_PASSWORD from .env)
aio-run: aio-build
    LORESTUDIO_TAG=dev docker compose -f docker-compose.aio.yml up -d --no-build

# ── Quality gates ──────────────────────────────
# Exactly what GitHub CI runs (.github/workflows/ci.yml), locally. Run before pushing.
ci:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "── personal data ──"         && python3 scripts/check-pii.py
    echo "── file-length budget ──"     && python3 scripts/check-size.py
    echo "── design tokens ──"         && python3 scripts/check-tokens.py
    echo "── tracked documents ──"     && python3 scripts/check-docs.py
    echo "── generated files ──"        && (cd backend && uv run python scripts/gen_ai_features.py --check)
    echo "── backend: ruff ──"          && (cd backend && uv run ruff check app/ tests/ scripts/ && uv run ruff format --check app/ tests/ scripts/)
    echo "── backend: ty ──"            && (cd backend && uv run ty check app/)
    echo "── backend: pytest ──"        && (cd backend && uv run python -m pytest -q --cov)
    echo "── backend: migrations ──"    && (cd backend && uv run python -m pytest -q tests/test_migrations.py)
    echo "── frontend: prettier ──"     && (cd frontend && npm run format:check)
    echo "── frontend: tsc ──"          && (cd frontend && npm run typecheck)
    echo "── frontend: eslint ──"       && (cd frontend && npm run lint)
    echo "── frontend: vitest ──"       && (cd frontend && npm run test:coverage)
    echo "── frontend: build ──"        && (cd frontend && npm run build)
    echo "✓ ci green"

# Regenerate files derived from backend tables (AI feature table -> TypeScript)
gen:
    cd backend && uv run python scripts/gen_ai_features.py

# Lint everything (no tests)
lint:
    cd backend && uv run ruff check app/ tests/ scripts/ && uv run ruff format --check app/ tests/ scripts/
    cd frontend && npm run lint && npm run format:check

# Auto-fix what can be fixed, then format
fix:
    cd backend && uv run ruff check --fix app/ tests/ scripts/ && uv run ruff format app/ tests/ scripts/
    cd frontend && npx eslint . --fix; npm run format

typecheck:
    cd backend && uv run ty check app/
    cd frontend && npm run typecheck

# File-length budget (`just check-size --update` reprints the debt list)
check-size *ARGS:
    python3 scripts/check-size.py {{ARGS}}

# Design-token budget (`just check-tokens --update` reprints the debt blocks)
check-tokens *ARGS:
    python3 scripts/check-tokens.py {{ARGS}}

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

# Retake the README's screenshots from the demo stories (own servers, throwaway database)
screenshots:
    uv run --no-project --with playwright python scripts/screenshots.py

# Make every logo and icon file (favicons, app icons, README, Unraid) from docs/images/lorestudio-logo.svg
icons:
    uv run --no-project --with pillow python scripts/icons.py

# ── Release ────────────────────────────────────
# Cut a release: `just release 2026.10.1 notes.md`. Creates the GitHub release and its tag;
# release-images.yml then publishes the images. Notes are written, never generated: feature
# sections, then Fixes, then Smaller things.
release VERSION NOTES:
    #!/usr/bin/env bash
    set -euo pipefail
    version="{{VERSION}}"
    [[ "$version" == v* ]] || version="v$version"
    if ! [[ "$version" =~ ^v[0-9]{4}\.[0-9]{2}\.[0-9]+$ ]]; then
        echo "Error: the version is CalVer, YYYY.MM.N (2026.10.1)"; exit 1
    fi
    if [ ! -f "{{NOTES}}" ]; then
        echo "Error: notes file not found: {{NOTES}}. Write the release notes first."; exit 1
    fi
    if ! git diff --quiet HEAD; then
        echo "Error: uncommitted changes. Commit or stash first."; exit 1
    fi
    command -v gh >/dev/null || { echo "Error: gh CLI not found (https://cli.github.com)"; exit 1; }
    git fetch --quiet origin main
    if [ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]; then
        echo "Error: local main and origin/main differ. Push or pull first."; exit 1
    fi
    gh release create "$version" --target main --notes-file "{{NOTES}}" --latest
    echo "✓ Released $version: the images build in Actions › Release images"

# ── Desktop (macOS proof of concept) ───────────
# The app as a macOS app: the web app, the backend frozen by PyInstaller (with WeasyPrint's
# libraries from Homebrew, spaCy and pandoc inside), in a Tauri window. Needs Rust and
# `brew install pango`. Builds build/desktop/…/LoreStudio.app and a .dmg. See desktop/README.md.
pandoc_version := "3.12.1"

desktop: desktop-backend
    #!/usr/bin/env bash
    set -euo pipefail
    (cd desktop && npm install --silent && npx tauri build)
    out=desktop/src-tauri/target/release/bundle/macos
    # The backend goes in with ditto, not as a Tauri resource: Tauri copies a symlink as a
    # second file, and two copies of one library must never load into one process.
    rm -rf "$out/LoreStudio.app/Contents/Resources/backend"
    ditto build/desktop/dist/lorestudio-backend "$out/LoreStudio.app/Contents/Resources/backend"
    codesign --force --deep --sign - "$out/LoreStudio.app"
    # The disk image holds the app and a shortcut to Applications, to drag it onto.
    stage=build/desktop/dmg
    rm -rf "$stage" "$out/LoreStudio.dmg" && mkdir -p "$stage"
    ditto "$out/LoreStudio.app" "$stage/LoreStudio.app"
    ln -s /Applications "$stage/Applications"
    hdiutil create -quiet -volname LoreStudio -srcfolder "$stage" -format UDZO "$out/LoreStudio.dmg"
    echo "✓ $out/LoreStudio.app ($(du -sh "$out/LoreStudio.app" | cut -f1)), LoreStudio.dmg ($(du -sh "$out/LoreStudio.dmg" | cut -f1))"

desktop-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p build/desktop
    pandoc="build/desktop/pandoc-{{pandoc_version}}-arm64/bin/pandoc"
    if [ ! -x "$pandoc" ]; then
        curl -fsSL -o build/desktop/pandoc.zip \
            "https://github.com/jgm/pandoc/releases/download/{{pandoc_version}}/pandoc-{{pandoc_version}}-arm64-macOS.zip"
        unzip -q -o build/desktop/pandoc.zip -d build/desktop
    fi
    (cd frontend && npm run build)
    cd backend
    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib LORESTUDIO_PANDOC="$PWD/../$pandoc" \
        uv run --group desktop pyinstaller ../desktop/backend/lorestudio-backend.spec --noconfirm \
        --distpath ../build/desktop/dist --workpath ../build/desktop/work --log-level WARN

# ── Utilities ──────────────────────────────────
# Copy .env.example to .env if it doesn't exist
init-env:
    cp -n .env.example .env && echo ".env created" || echo ".env already exists"

# Show running services
status:
    docker compose ps
