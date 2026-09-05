# Installation Guide

This guide covers setting up LoreStudio for local development and self-hosted deployment.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.13+ | For the backend API |
| Node.js | 20+ | For the frontend |
| uv | Latest | Python package manager ([install](https://docs.astral.sh/uv/getting-started/installation/)) |
| just | Latest | Task runner ([install](https://github.com/casey/just#installation)) |
| Ollama | Latest | **Optional** — only needed for AI features |

### Installing Prerequisites

**macOS (Homebrew):**
```bash
brew install python@3.13 node uv just
```

**Ollama** (optional, for AI features):
```bash
brew install ollama
ollama serve  # Start the Ollama server
ollama pull gemma4  # Download the recommended model
```

---

## Quick Setup

The fastest path from clone to running:

```bash
git clone https://github.com/your-username/LoreStudio.git
cd LoreStudio

# Create your environment file
just init-env

# Edit .env with your preferred settings (at minimum, change ADMIN_PASSWORD)
# nano .env

# Install all dependencies
just setup

# Start both backend and frontend
just dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Manual Setup

If you prefer explicit steps or don't have `just` installed:

### Backend

```bash
cd backend

# Install Python dependencies
uv sync

# Download the spaCy English model (for NLP analysis features)
# (the spaCy model is a declared dependency; `uv sync` installs it)

# Start the API server
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

---

## Docker Deployment

For self-hosting on a server, NAS, or Unraid:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values (especially SECRET_KEY and ADMIN_PASSWORD)

# Build and start containers
docker compose up -d

# View logs
docker compose logs -f
```

### Connecting to Ollama

If Ollama runs on the Docker host (not in a container), update your `.env`:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Volume Mappings

For persistent data, the default `docker-compose.yml` maps:

| Container Path | Host Path | Purpose |
|----------------|-----------|---------|
| `/app/data` | `./data` | Database and snapshots |
| `/app/config` | `./config` | Configuration files |

**Unraid example:**
```env
DATA_PATH=/mnt/user/appdata/lorestudio/data
CONFIG_PATH=/mnt/user/appdata/lorestudio/config
```

---

## First Run

### Default Login

The initial admin account is created from your `.env` settings:

- **Username:** Value of `ADMIN_USERNAME` (default: `admin`)
- **Password:** Value of `ADMIN_PASSWORD` (change this!)

### Demo Story

On first startup, LoreStudio seeds a demo story called "The Last Lighthouse" that showcases the platform's features. You can explore it to understand the tools, then delete it when you're ready to start your own work.

### AI Features

AI-powered features (character interviews, story analysis, writing coach, etc.) require Ollama to be running with a model loaded. If Ollama isn't available, these features simply won't appear or will show an error — all non-AI features work normally.

---

## Updating

When pulling new versions:

```bash
git pull

# Re-install dependencies (in case they changed)
just setup

# Run database migrations
just db-migrate

# Restart the server
just dev
```

---

## Available Commands

Run `just` to see all available tasks:

| Command | Description |
|---------|-------------|
| `just dev` | Start backend + frontend concurrently |
| `just setup` | Install all dependencies |
| `just test` | Run backend tests |
| `just ci` | Run every quality gate (what GitHub CI runs) |
| `just db-migrate` | Apply pending database migrations |
| `just db-reset` | **Destructive:** Reset database to fresh state |
| `just build` | Build Docker images |
| `just up` / `just down` | Start/stop Docker containers |

---

## Troubleshooting

### "Database is locked"

SQLite only supports one writer at a time. Ensure you don't have multiple server instances running.

### PDF export fails

PDF export requires the `pango` system library:

```bash
# macOS
brew install pango

# Ubuntu/Debian
apt-get install libpango-1.0-0 libpangocairo-1.0-0
```

### Ollama connection refused

1. Ensure Ollama is running: `ollama serve`
2. Check your `OLLAMA_BASE_URL` in `.env`
3. For Docker, use `http://host.docker.internal:11434`

### "Model not found" errors

Pull the model specified in your `.env`:

```bash
ollama pull gemma4  # or whatever OLLAMA_MODEL is set to
```

### Frontend can't reach backend

The frontend expects the API at `http://localhost:8000`. If you've changed the backend port, update the frontend's API client configuration.
