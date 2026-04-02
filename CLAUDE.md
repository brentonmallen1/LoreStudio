# LoreStudio

**A writer support platform — not an AI content generator.** LoreStudio helps authors plan, organize, and understand their stories using structured data and AI assistance. The human does the writing; the tools help them think clearly about what they're building.

The guiding philosophy: data-centric, organized, intentional. Every feature should help a writer answer "what is this story, why does it exist, and where is it going?" — not generate content for them.

## Design Principles

- **Informative, not intrusive** — UI supports the writing process, doesn't distract from it
- **Warm and minimal** — Clean, uncluttered aesthetic using the established warm color palette
- **Structured flexibility** — Story structure is abstract (StoryStructureTemplate + StructureNode tree) to support any narrative form
- **Author intent as first-class data** — Narrative intent, arc milestones, segment purpose/synopsis are as important as the prose itself
- **Seed data tells the story** — When implementing new features, update the demo story ("The Last Lighthouse") to show off how the feature is meant to be used
- **Update FUTURE_FEATURES.md** — Check off items as they're implemented, including a brief description of what was built

## Commands

```bash
just dev              # Start backend (:8000) + frontend (:5173) concurrently
just setup            # Install all dependencies (uv + npm)
just test             # pytest -v
just test-watch       # pytest with file watcher
```

Or run separately:
```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

Frontend checks:
```bash
cd frontend && npm run build   # TypeScript + Vite build
cd frontend && npm run lint    # ESLint
```

## Database

Schema is created via `Base.metadata.create_all()` in the FastAPI lifespan on startup. **Alembic exists but `create_all` only creates missing tables — it never adds columns.** Adding a new column requires both a model change and an Alembic migration.

To reset and reseed from scratch:
```bash
cd backend && rm -f data/lorestudio.db && uv run python -c "
import importlib, os
for f in os.listdir('app/models'):
    if f.endswith('.py') and f != '__init__.py':
        try: importlib.import_module(f'app.models.{f[:-3]}')
        except: pass
from app.database import engine, Base; Base.metadata.create_all(engine)
from app.services.seed import seed_structure_templates, seed_admin, seed_demo_story
seed_structure_templates(); seed_admin(); seed_demo_story()
"
```

All three seed functions are idempotent (skip if data exists) and run automatically on every backend startup.

## Architecture

### Backend (`backend/app/`)
```
main.py           — App init, router mounts, lifespan (DB create + seed)
config.py         — Pydantic Settings, reads from .env
database.py       — SQLAlchemy engine, Base, get_db() dependency
auth/             — JWT login, get_current_user dependency
models/           — SQLAlchemy ORM models
routers/          — API routers (stories, characters, interviews, threads, panels, analysis...)
schemas/          — Pydantic request/response models
services/
  seed.py         — seed_admin(), seed_structure_templates(), seed_demo_story()
  llm/            — Ollama integration (abstracted via base.py for future BYOK support)
```

### Frontend (`frontend/src/`)
```
App.tsx           — BrowserRouter, RequireAuth guard, page routes
api/client.ts     — Single fetch wrapper + every API method
stores/           — Zustand: authStore, uiStore, storyStore
pages/            — Login, Dashboard, StoryWorkspace, Settings
components/       — Feature components organized by domain
  layout/         — Sidebar, InterviewPanel
  story/          — SceneEditor, CorkboardView, StorySummaryPanel, StoryBiblePanel
  characters/     — CharacterSheet, CharacterList, RelationshipGraph
  threads/        — PlotThreadManager, ThreadVisualization
  panels/         — Group interview (multi-character panel)
  analysis/       — Perspective summaries
types/index.ts    — All shared TypeScript interfaces
```

## Key Patterns

### CSS design tokens
All colors use CSS custom properties defined in `frontend/src/index.css`. Dark mode adds a `.dark` class to `<html>`. Never hardcode colors — always use `var(--color-*)`. Segment type colors use `var(--segment-act)`, `var(--segment-chapter)`, etc. Both light and dark variants are defined.

### Story structure
`StoryStructureTemplate` defines named levels (e.g. Act → Chapter → Scene). `StructureNode` is a recursive tree with `level`, `level_type`, `parent_id`. The active template is loaded into `storyStore.activeTemplate` on workspace load — use it to drive type-aware UI (labels, icons, "Add X" buttons).

### Streaming AI responses
Character interviews, story summaries, and attribute generation return `StreamingResponse` from FastAPI. The API client returns the raw `Response` object for these — not parsed JSON. Frontend handles chunked text via `response.body.getReader()`.

### AI features require Ollama
All LLM features call a local Ollama instance. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env`. If Ollama isn't running, AI features fail silently or return errors — non-AI features work fine.

### Auth
JWT token stored in `localStorage` as `ls_token`. Sent as `Authorization: Bearer <token>` on every request. Token expires after 7 days (configurable). On 401, the API client clears the token and redirects to `/login`.

### bcrypt version
`bcrypt` is pinned to `<5` in requirements — passlib is incompatible with bcrypt 5.x.

### Character interviews
The character's full profile becomes the LLM system prompt — the character IS the persona, not injected as context. This keeps interviews feeling like talking to the character rather than about them.

## Environment Setup

Copy `.env.example` to `.env`. Minimum required:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
SECRET_KEY=any-random-string-for-dev
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
DATABASE_URL=sqlite:///./data/lorestudio.db
```

## Feature Tracking

See `FUTURE_FEATURES.md` for the full backlog. When implementing any item:
1. Mark it `[x]` with a brief description of what was built
2. Update the seed demo story to demonstrate the feature
3. Update the "Last updated" line at the bottom of the file
