# Configuration Reference

LoreStudio is configured through environment variables, typically set in a `.env` file at the project root.

---

## Environment Variables

Every variable has a default; only `SECRET_KEY` and `ADMIN_PASSWORD` must be set
when `ENV=prod` (the backend refuses to start with the defaults).

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `dev` | `dev` or `prod`. Prod refuses default secrets. Docker images default to `prod`. |
| `PORT` | `8000` | Backend API port (compose) |
| `FRONTEND_PORT` | `5173` | Frontend port (compose) |
| `TZ` | `America/Los_Angeles` | Timezone for timestamps and logs |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated browser origins allowed to call the API. Add your reverse-proxy origin. |
| `LOG_LEVEL` | `INFO` | Backend log level |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | dev placeholder | JWT signing key. `openssl rand -hex 32`. Required in prod. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Login session length (7 days) |
| `ADMIN_USERNAME` | `admin` | Initial admin account |
| `ADMIN_PASSWORD` | `change-me` | Initial admin password. Required in prod. |

### Database and files

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/lorestudio.db` | SQLAlchemy URL (SQLite; WAL mode and foreign keys are enabled automatically) |
| `AUTO_MIGRATE` | `true` | Run Alembic migrations on start (see [upgrading.md](upgrading.md)) |
| `SNAPSHOTS_PATH` | `./data/snapshots` | Story snapshot archives |
| `UPLOADS_PATH` | `./data/uploads` | Uploaded media |
| `BACKUPS_PATH` | `./data/backups` | Nightly SQLite backups |
| `DB_BACKUP_ENABLED` | `true` | Nightly `VACUUM INTO` backup of the database |
| `DB_BACKUP_KEEP` | `14` | Nightly backups retained |

### Demo content

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_DEMO` | `true` | Seed "The Last Lighthouse" into an empty database |
| `SEED_EXTRA_DEMOS` | `false` | Also seed the sci-fi, flash fiction, short story and first-person demos |

### Paths (compose bind mounts)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_PATH` | `./data` | Host path mounted at `/app/data` (database, snapshots, uploads, backups) |

### AI / Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `gemma4` | Default model |
| `OLLAMA_TEMPERATURE` | `1.0` | Sampling temperature |
| `OLLAMA_TOP_P` | `0.95` | |
| `OLLAMA_TOP_K` | `64` | |
| `OLLAMA_KEEP_ALIVE` | `10m` | How long the model stays loaded after a request |
| `OLLAMA_THINKING_ENABLED` | `false` | Gemma 4 thinking mode by default (per-feature overrides in Settings) |

---

## Ollama Setup

### Installing Ollama

Visit [ollama.ai](https://ollama.ai) for platform-specific installation, or:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
```

Start the Ollama server:
```bash
ollama serve
```

### Recommended Model: Gemma 4

LoreStudio is optimized for **Gemma 4**, Google's multimodal model:

```bash
ollama pull gemma4
```

Update your `.env`:
```env
OLLAMA_MODEL=gemma4
```

#### Why Gemma 4?

| Feature | Benefit |
|---------|---------|
| **Thinking mode** | Structured reasoning before responses — better analysis |
| **Vision support** | Analyze reference images for character/setting inspiration |
| **Large context** | 128K–256K tokens — handles long stories and full manuscripts |
| **Quality** | Strong creative writing understanding and nuanced responses |

#### Gemma 4 Parameters

For best results, LoreStudio uses Google's recommended defaults:
- Temperature: 1.0
- Top-p: 0.95
- Top-k: 64

These are handled automatically when using Gemma 4.

### Alternative Models

Any Ollama-compatible model works. Tested alternatives:

| Model | Pros | Cons |
|-------|------|------|
| `llama3.2` | Good general-purpose, widely used | No vision support |
| `mistral` | Fast responses, efficient | Smaller context window |
| `phi3` | Lightweight, runs on modest hardware | Less nuanced for creative tasks |
| `qwen2.5` | Strong multilingual support | Larger download |

#### Model Selection Tips

- **Character interviews:** Larger models (7B+) produce richer, more consistent personalities
- **Quick analysis:** Smaller models are faster for simple checks
- **Image features:** Gemma 4 or other vision-capable models required

---

## Docker Configuration

### Connecting to Host Ollama

When running LoreStudio in Docker with Ollama on the host machine:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Production Environment Example

```env
# Server
PORT=8000
TZ=UTC

# Security — CHANGE THESE
SECRET_KEY=your-very-long-random-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Database
DATABASE_URL=sqlite:///./data/lorestudio.db
SNAPSHOTS_PATH=./data/snapshots

# Paths for Docker volumes
DATA_PATH=/path/to/persistent/data
CONFIG_PATH=/path/to/persistent/config

# AI
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gemma4
OLLAMA_TEMPERATURE=0.8
OLLAMA_KEEP_ALIVE=10m
```

---

## Feature-Specific Configuration

### PDF Export

PDF export uses [WeasyPrint](https://weasyprint.org/), which requires the `pango` system library:

```bash
# macOS
brew install pango

# Ubuntu/Debian
apt-get install libpango-1.0-0 libpangocairo-1.0-0

# Fedora/RHEL
dnf install pango
```

### NLP Analysis Features

Local prose analysis (passive voice detection, adverb usage, etc.) uses spaCy. The English model is installed during setup:

```bash
uv run python -m spacy download en_core_web_sm
```

This runs automatically with `just setup`, but you can run it manually if needed.

---

## Sample .env File

```env
# ─────────────────────────────────────────────
# LoreStudio — Environment Configuration
# ─────────────────────────────────────────────

# Server
PORT=8000
FRONTEND_PORT=5173
TZ=America/Los_Angeles

# Paths (override for deployment)
DATA_PATH=./data
CONFIG_PATH=./config

# Security — CHANGE THESE IN PRODUCTION
SECRET_KEY=change-me-to-a-long-random-string-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

# LLM — Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4
OLLAMA_TEMPERATURE=0.8
OLLAMA_KEEP_ALIVE=10m

# Database
DATABASE_URL=sqlite:///./data/lorestudio.db
SNAPSHOTS_PATH=./data/snapshots
```
