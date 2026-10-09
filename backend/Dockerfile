# The API image. Built from the repository root (compose and CI pass `context: .`), so the
# root .dockerignore keeps the local .venv, node_modules and data out of the build.
#
# Pinned to the Python the lockfile and CI run on. spaCy and friends publish wheels for new
# CPython releases months later; a base-image bump must be tested locally first (see dependabot.yml).
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# pandoc for DOCX/EPUB export; pango and harfbuzz for WeasyPrint's PDF export.
RUN apt-get update && apt-get install -y --no-install-recommends \
    pandoc \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencies, from the lockfile (the spaCy model is a locked dependency) ──
FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.23 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev
# Readable by the runtime user whatever the build machine's file modes were.
RUN chmod -R a+rX /app

# ── Runtime ──
FROM base AS runtime
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} \
    INSTALL_KIND=docker \
    ENV=prod \
    PATH=/app/.venv/bin:$PATH \
    DATABASE_URL=sqlite:////app/data/lorestudio.db \
    SNAPSHOTS_PATH=/app/data/snapshots \
    UPLOADS_PATH=/app/data/uploads \
    BACKUPS_PATH=/app/data/backups
WORKDIR /app
COPY --from=build /app /app
RUN useradd -m -u 1000 appuser && mkdir -p /app/data && chown -R appuser:appuser /app/data
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
