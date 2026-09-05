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
- **Transparent by default** — Background work is never hidden. Every AI interaction, task run, and automated update is logged and accessible. The author can always see what the system did and why.
- **Proactive, not presumptuous** — The system anticipates needs (pre-computing summaries, caching context, flagging issues) but never acts without permission. Prepare the data; don't make decisions.
- **Context as infrastructure** — The system maintains knowledge graphs, conversation history, and summaries as invisible infrastructure that makes AI interactions smarter without manual management.

## Naming Vocabulary

LoreStudio uses a consistent vocabulary for its major information domains:

- **Lorebook** — Story canon: characters, settings, relationships, themes, narrative intent, goals. The authoritative reference for "what is true in this story."
- **Manuscript** — The prose being written: scenes, chapters, the actual text content.
- **Compendium** — Research & reference materials: supplemental documents, URLs, notes, PDFs. Information that informs the story but isn't part of it.
- **Codex** — AI knowledge infrastructure: the knowledge graph, embeddings, semantic index. The system's learned understanding of the story.
- **Chronicle** — History & logs: conversation history, generated analyses, reports, activity logs, AI audit trail.

Use these terms consistently in code, UI, and documentation.

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
  story/          — SceneEditor, CorkboardView, StorySummaryPanel, LorebookPanel
  characters/     — CharacterSheet, CharacterList, RelationshipGraph
  threads/        — PlotThreadManager, ThreadVisualization
  panels/         — Group interview (multi-character panel)
  analysis/       — Perspective summaries
types/index.ts    — All shared TypeScript interfaces
```

## Key Patterns

### CSS design tokens
All colors use CSS custom properties defined in `frontend/src/index.css`. Dark mode adds a `.dark` class to `<html>`. Never hardcode colors — always use `var(--color-*)`. Segment type colors use `var(--segment-act)`, `var(--segment-chapter)`, etc. Both light and dark variants are defined.

**AI color:** Use `var(--color-ai)` (purple) for all AI-related UI elements — icons, buttons, highlights, borders. Never use `var(--color-accent)` (warm orange) for anything AI-related.

**NLP color:** Use `var(--color-nlp)` (cyan/teal) for all local NLP analysis UI elements — icons, buttons, highlights, borders. This distinguishes deterministic spaCy-based features from LLM-powered AI features (purple). Each theme defines its own native cyan/teal variant.

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

### Unified AI assistant
All AI tools (interview, what-if, panel, writing coach, etc.) are accessed through a single AI panel opened via the header button. No redundant AI entry points in sub-components (scene editor topbar, etc.) — the header button is the one place. Each tool runs in its own tab within the panel, preserving conversation history.

To add a new AI session type: (1) register it in `frontend/src/lib/ai/sessions.ts` via `registerSessionType`, (2) add a `case` in `frontend/src/components/ai/SessionView.tsx`, (3) create a mode component using `AIModeWrapper` as the shell.

### AI UI component patterns

**Never use the `Sparkles` icon for AI buttons.** The app has established conventions — use them everywhere, without exception.

| Element | Icon | When to use |
|---------|------|-------------|
| Open AI chat / workshop | `Feather` + text label | Open the AI panel to a chat session (conversation, workshop, guide) |
| AI action button (idle) | `Compass` + text label | Trigger inline generation, analysis, or drafting |
| AI action button (active) | `Square` + "Cancel" | While streaming, to abort |
| Attribute generation | `Wand2` + text | Per-field attribute suggestions |
| Feature info modal trigger | `Cpu` via `AIFeatureInfoTrigger` | In every panel/page header that has AI features |
| Transparency trigger | `ShieldCheck` via `LLMTransparencyTrigger` | Next to AI-generated results |

**Button style:** `background: var(--color-ai)`, `color: var(--color-ai-fg)`. Match `.generateBtn` in `StorySummaryPanel.module.css` exactly — that is the canonical reference.

**Text labels are required.** An icon alone is never enough. Label examples: "Draft logline", "Suggest themes", "Generate summary", "Identify conflict".

**`AIFeatureInfoTrigger` is mandatory** on any panel or page that exposes AI features. It renders the `Cpu` icon button that opens `AIFeatureInfoModal`. Place it in the panel header next to the title.

**`LLMTransparencyTrigger`** (`ShieldCheck`) must appear next to AI-generated content so the author can inspect what was sent to the model. Use the `useLLMTransparency` hook.

**Register every new AI feature** in `frontend/src/lib/ai/featureRegistry.ts` under the correct `pageId`. This powers the feature info modal. Format:
```ts
{
  id: "page-action-name",
  label: "Human-readable label",
  description: "What this does and when to use it",
  type: "ai",
  backendFeatureId: "backend-feature-key",
}
```

## Environment Setup

Copy `.env.example` to `.env`. Minimum required:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
SECRET_KEY=any-random-string-for-dev
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4
DATABASE_URL=sqlite:///./data/lorestudio.db
```

### Recommended Model: Gemma 4

LoreStudio is built around **Gemma 4** (`gemma4`) served via Ollama. Key integration points:

- **Thinking mode**: Enabled by prepending `<|think|>` to the system prompt. The model then generates `<|channel>thought\n[reasoning]<channel|>` blocks before its final answer. Disable by omitting the token (default).
- **Recommended parameters**: Temperature 1.0, top-p 0.95, top-k 64 — these are Google's published best-practice defaults.
- **Multi-turn history**: Strip `<|channel>thought\n...<channel|>` blocks from assistant messages before appending them to conversation history. Thoughts from previous turns must not be re-sent to the model.
- **Multi-modal**: Images must be placed before text in the prompt. Image detail is controlled by token budgets: 70/140 (fast, classification), 280 (balanced default), 560/1120 (high detail, OCR).
- **Context windows**: 128K tokens (E2B/E4B), 256K tokens (26B/31B and above).

## Testing

**Test as you build.** Every new service function, especially pure logic, should have corresponding tests. Tests catch regressions early and document expected behavior.

### Backend Testing (`backend/`)

Run tests:
```bash
just test              # pytest -v
just test-watch        # pytest with file watcher
cd backend && uv run pytest -v  # direct
```

Test structure mirrors app structure:
```
backend/tests/
  conftest.py           — Fixtures: test DB, mock ORM objects, API client
  services/             — Unit tests for pure service functions
    test_mice_validation.py
    test_word_count.py
  routers/              — Integration tests for API endpoints
    test_health.py
    test_stories.py
```

#### What to test
- **Pure functions first** — validation logic, calculations, transformations (no DB/network)
- **API endpoints** — request/response contracts, auth requirements, error cases
- **Skip mocking LLM** — AI-dependent features are tested manually; don't mock Ollama responses

#### When to write tests
- New service functions: write tests alongside implementation
- Bug fixes: write a failing test first, then fix
- Refactors: ensure existing tests pass before and after

#### Test fixtures (conftest.py)
- `test_db` — In-memory SQLite session for isolated DB tests
- `mock_thread(...)` — Factory for PlotThread-like objects with test data
- `api_client` — TestClient with auth headers for endpoint tests

## Feature Tracking

See `FUTURE_FEATURES.md` for the full backlog. When implementing any item:
1. Mark it `[x]` with a brief description of what was built
2. Update the seed demo story to demonstrate the feature
3. Update the "Last updated" line at the bottom of the file
