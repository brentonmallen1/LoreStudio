# Configuration Reference

LoreStudio is configured through environment variables, typically set in a `.env` file at the project root.

---

## Environment Variables

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Backend API port |
| `FRONTEND_PORT` | `5173` | Frontend dev server port |
| `TZ` | `America/Los_Angeles` | Timezone for timestamps and logs |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *required* | JWT signing key. Use a random 32+ character string. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | How long login sessions last (default: 7 days) |
| `ADMIN_USERNAME` | `admin` | Initial admin account username |
| `ADMIN_PASSWORD` | *required* | Initial admin account password |

**Generating a secret key:**
```bash
openssl rand -hex 32
```

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/lorestudio.db` | SQLAlchemy database URL |
| `SNAPSHOTS_PATH` | `./data/snapshots` | Where version snapshots are stored |

### Paths (Docker/Deployment)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_PATH` | `./data` | Host path for data volume mount |
| `CONFIG_PATH` | `./config` | Host path for config volume mount |

### AI / Ollama Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Default model for AI features |
| `OLLAMA_TEMPERATURE` | `0.8` | Generation temperature (0.0–2.0) |
| `OLLAMA_KEEP_ALIVE` | `10m` | How long to keep the model loaded after requests |

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
