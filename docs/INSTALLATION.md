# Installing LoreStudio

To **run** LoreStudio on a server, a NAS or Unraid, use the Docker images:
[deployment.md](deployment.md) (and [unraid.md](unraid.md)). This page is for running it
**from source**, to develop it or to try it on your own machine.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.13 | Managed by uv |
| Node.js | 22 | The frontend |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | latest | Python packages |
| [just](https://github.com/casey/just#installation) | latest | Every command (`just` lists them) |
| Pango, pandoc | | PDF and other exports (see [CONFIGURATION.md](CONFIGURATION.md#running-from-source-system-libraries)) |
| [Ollama](https://ollama.com) | latest | Optional: only the AI features need it |

On macOS:

```bash
brew install uv node just pango pandoc
brew install ollama && ollama serve && ollama pull gemma4   # optional, for AI
```

## Setup

```bash
git clone https://github.com/brentonmallen1/LoreStudio.git
cd LoreStudio
just init-env     # copies .env.example to .env
just setup        # backend (uv) and frontend (npm) dependencies
just dev          # the API on :8000 and the app on :5173
```

Open <http://localhost:5173> and sign in as `admin` with the `ADMIN_PASSWORD` from `.env`
(`change-me` until you change it; fine for `ENV=dev`).

The first start creates the database in `data/`, runs the migrations and adds the demo story
"The Last Lighthouse". `SEED_EXTRA_DEMOS=true` adds the other demo stories and the
Lighthouse's sequel, which makes a series.

`just dev-stop` frees the two ports if something was left running. If another app already uses
8000 or 5173, set `PORT` and `FRONTEND_PORT` in `.env`; the Vite proxy follows `PORT`.

## Without just

```bash
cd backend && uv sync && uv run python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

On macOS with Homebrew's Pango, start the backend with `DYLD_LIBRARY_PATH=/opt/homebrew/lib`
(what `just backend` does) or PDF export fails to load.

## Updating a checkout

```bash
git pull
just setup        # dependencies may have changed
just dev          # the database migrates on start
```

## Commands

`just` lists every recipe. The ones you will use:

| Command | What it does |
|---|---|
| `just dev` / `just dev-stop` | Start / free the API and the app |
| `just setup` | Install dependencies |
| `just test` | Backend tests |
| `just ci` | Every check GitHub CI runs (run before pushing) |
| `just hooks` | Install the pre-commit hook (the fast checks) |
| `just db-migrate` / `just db-check` | Apply migrations / check models and migrations agree |
| `just db-reset` | **Destructive**: an empty database on next start |
| `just build` / `just up` / `just down` | The two-container Docker setup |
| `just aio-build` / `just aio-run` | The all-in-one image |

## Troubleshooting

- **"Database is locked"**: SQLite takes one writer at a time; two backends on the same database
  (an old `just dev` still running) cause it. `just dev-stop`.
- **PDF export fails**: Pango is missing, or on macOS the backend was started without
  `DYLD_LIBRARY_PATH`.
- **AI features say the model is not answering**: is Ollama running (`ollama serve`), is the
  model pulled (`ollama list`), and does `OLLAMA_BASE_URL` point at it?
- **The app cannot reach the API**: the Vite dev server proxies `/api` to `PORT`; check the
  backend is running on that port.
