# Configuration

LoreStudio reads its settings from environment variables. Running from source, they come from
`.env` at the project root (`just init-env` copies [`.env.example`](../.env.example), which lists
them all). In Docker, the same variables are passed to the container; see
[deployment.md](deployment.md).

Most of what LoreStudio does is configured in the app itself (*Settings*): the AI model's
parameters per feature, the Codex's embedding model, automatic work and its schedule, backups,
themes. The variables below are what has to be known before the app starts.

Every variable has a default. With `ENV=prod` (the Docker images' default) the app refuses to
start while `SECRET_KEY` or `ADMIN_PASSWORD` is a default value. The all-in-one image makes a
`SECRET_KEY` itself when none is given.

## The app

### Server and security

| Variable | Default | What it does |
|---|---|---|
| `ENV` | `dev` (`prod` in the images) | `prod` refuses default secrets |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |
| `SECRET_KEY` | a dev placeholder | Signs sign-in tokens. `openssl rand -hex 32`. Changing it signs everyone out |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | How long a sign-in lasts (7 days) |
| `ADMIN_USERNAME` | `admin` | The admin account, created on first start |
| `ADMIN_PASSWORD` | `change-me` | Its password, set on first start (change it in the app afterwards) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Browser origins allowed to call the API directly. Behind the images' nginx, the app and API share an origin and this does not matter |

### Data

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/lorestudio.db` | The SQLite database (WAL mode and foreign keys are set automatically) |
| `AUTO_MIGRATE` | `true` | Migrate the database on start (see [upgrading.md](upgrading.md)) |
| `SNAPSHOTS_PATH` | `./data/snapshots` | Saved story versions |
| `UPLOADS_PATH` | `./data/uploads` | Images and files you add |
| `BACKUPS_PATH` | `./data/backups` | Automatic copies of the database |
| `DB_BACKUP_ENABLED` | `true` | The starting value of *Settings › Automatic work › Database backup* |
| `DB_BACKUP_KEEP` | `14` | How many database backups that keeps, to begin with |
| `AI_PAYLOAD_RETENTION_DAYS` | `90` | Days to keep the text of AI prompts and replies. That each call happened is kept for good; `0` keeps the text too |

### Demo stories

| Variable | Default | What it does |
|---|---|---|
| `SEED_DEMO` | `true` | Add "The Last Lighthouse" to an empty database |
| `SEED_EXTRA_DEMOS` | `false` | Also add the other demo stories and the Lighthouse's sequel, which makes a series |

### AI (Ollama)

| Variable | Default | What it does |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | The Ollama server |
| `OLLAMA_MODEL` | `gemma4` | The model |
| `OLLAMA_TEMPERATURE` | `1.0` | Sampling temperature (Gemma 4's recommended value) |
| `OLLAMA_TOP_P` | `0.95` | |
| `OLLAMA_TOP_K` | `64` | |
| `OLLAMA_KEEP_ALIVE` | `10m` | How long the model stays loaded after a call (`-1`: always) |
| `OLLAMA_THINKING_ENABLED` | `false` | Gemma 4's thinking by default; *Settings › Model parameters* chooses per feature |

### Set by the image

| Variable | Default | What it does |
|---|---|---|
| `APP_VERSION` | `dev` | The release, stamped by the release build and shown in *Settings* |

## Docker and deployment

These are read by the compose files and the images, not by the app.

| Variable | Default | Where | What it does |
|---|---|---|---|
| `WEB_PORT` | `8080` | both compose files | The port the app is served on |
| `DATA_PATH` | `./data` | both compose files | The host folder mounted as the data folder |
| `LORESTUDIO_TAG` | `latest` | both compose files | Which published image to run (`2026.10.1`, `2026.10`) |
| `TZ` | `UTC` | images | Timezone for dates and the schedule of automatic work |
| `PUID` / `PGID` | `1000` | all-in-one | Who owns the data folder (Unraid: `99` / `100`) |
| `API_UPSTREAM` | `backend:8000` | web image | Where its nginx finds the API |
| `PORT` | `8000` | `just dev` | The API's port when running from source |
| `FRONTEND_PORT` | `5173` | `just dev` | Vite's port when running from source |

## Ollama

Install it from [ollama.com](https://ollama.com) (`brew install ollama` on macOS), start it
(`ollama serve`) and pull the model:

```bash
ollama pull gemma4
```

LoreStudio is built around **Gemma 4**: its thinking mode, long context (128K–256K tokens, enough
for a whole manuscript) and image understanding. Its recommended parameters are the defaults
above. Other models Ollama serves work too; character interviews are richer with larger models,
and the image features need a vision model.

When LoreStudio runs in Docker and Ollama on the same machine, `localhost` is the container:
use `http://host.docker.internal:11434` (the compose files map it), or the machine's address.

### The Codex's embedding model

The Codex indexes a story so AI features can find passages by meaning. That uses a small
embedding model, chosen in *Settings › Codex* (not here):

```bash
ollama pull nomic-embed-text     # the default: fast, 768 dimensions
ollama pull mxbai-embed-large    # slower, 1024 dimensions, a little sharper
```

Vectors remember the model that made them and a search never mixes two models, so switching
leaves the old index inert until the next *Index story*. Search uses
[`sqlite-vec`](https://github.com/asg017/sqlite-vec) when it loads and the same arithmetic in
Python when it does not; *Settings › Codex* says which.

## Running from source: system libraries

The Docker images include these. From source:

- **PDF export** uses [WeasyPrint](https://weasyprint.org/), which needs Pango:
  `brew install pango` (macOS; `just backend` sets `DYLD_LIBRARY_PATH` for Homebrew),
  `apt-get install libpango-1.0-0 libpangoft2-1.0-0` (Debian/Ubuntu).
- **DOCX, EPUB, ODT, Markdown and HTML export** use [pandoc](https://pandoc.org/): `brew install pandoc`.
- **Local prose checks** use spaCy's English model, a locked dependency that `uv sync` installs.
