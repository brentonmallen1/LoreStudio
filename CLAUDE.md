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
just ci               # Everything GitHub CI runs: size budget, ruff, ty, pytest+coverage, prettier, tsc, eslint, vitest, build
just lint / just fix  # Lint only / auto-fix + format both halves
just test             # backend pytest -v (uses `python -m pytest`; robust to a moved venv)
just test-watch       # pytest with file watcher
just hooks            # Install the pre-commit hook (size budget + ruff, ~2s)
just db-check         # Models and Alembic migrations agree
```

**Run `just ci` before pushing.** It is byte-for-byte what `.github/workflows/ci.yml` runs.
Quality gates are ratchets: `scripts/check-size.py` (file-length debt list), coverage
`fail_under` in `backend/pyproject.toml`, ESLint warnings (the count goes down, never up).
Never raise a ratchet number. Planning docs for the 2026-09 refactor live in
`notes/refactor-2026-09/` (gitignored): read `CHECKLIST.md` before starting work.

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

**Alembic is the only schema path.** On startup `app/services/db_migrate.py` runs the
migration chain (fresh DB), adopts a database created by the old `create_all` path (stamps
it at head), or upgrades an existing one. See `docs/upgrading.md`.

Changing a model means adding a migration in the same change:
```bash
cd backend && uv run python -m alembic revision --autogenerate -m "add thing"
just db-check    # tests/test_migrations.py fails CI if models and migrations drift
```
Migrations use `render_as_batch=True` because SQLite cannot ALTER in place.

SQLite runs with `PRAGMA foreign_keys=ON` and WAL (`app/database.py`). Every child table
of Story has an ORM cascade or a nulling relationship; `test_delete_story_leaves_no_orphans`
walks `Base.metadata` and fails if a new `story_id` table is missed. Snapshots have the
same guard (`SNAPSHOT_KEYS_BY_TABLE` in `snapshot_service.py`).

To reset: `just db-reset`, then start the backend (migrations + seed run on start).
Seeding: templates, beat sheets and the admin user always; "The Last Lighthouse" only when
`SEED_DEMO=true` (default) and the DB has no stories; the other demos need
`SEED_EXTRA_DEMOS=true`. All seed functions are idempotent.

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
  layout/         — GlobalHeader, breadcrumb navigator, PageHeader, ModeGate
  strip/          — The story strip down the left edge (transit line, chapter rows, full tree)
  panel/          — The tabbed side panel beside the page (This scene, entity and tool tabs)
  findings/       — The findings feed: FindingRow, Run checks, the scene and sheet cards
                    (data in stores/findingsStore; the server computes every finding)
  proposals/      — The Proposals inbox row (stores/proposalsStore; gathered server-side)
  chronicle/      — Activity, conversations, changes; analysis/ draws any past run in full
  lorebook/       — The Lorebook browser: one EntitySheet for every kind (fields from
                    lib/lorebook/kinds.ts; an empty field is a word in the Add row), sections/
  story/          — CorkboardView, StoryboardView, StorySummaryPanel, StoryIdentityPanel
  overview/       — The Overview's cards: vitals, needs your eye, words by chapter, cast, lately
  characters/     — Character parts the Lorebook sheet uses: dialogue, arc, relationships, graph
  threads/        — ThreadVisualization (the Lorebook's thread map)
  panels/         — Group interview (multi-character panel)
  analysis/       — Perspective summaries
types/index.ts    — All shared TypeScript interfaces
```

## Key Patterns

### CSS design tokens
All colors use CSS custom properties. Shared tokens live in `frontend/src/themes/base.css`; each
palette is `frontend/src/themes/<name>.css` with `[data-theme="<name>"]` and `[data-theme="<name>"].dark`
blocks (`uiStore` sets `data-theme` on `<html>`; dark mode adds `.dark`). `src/themes/contrast.test.ts`
holds every palette to WCAG AA and runs in CI: change a token, run the test. Never hardcode colors — always use `var(--color-*)`. Segment type colors use `var(--segment-act)`, `var(--segment-chapter)`, etc. Both light and dark variants are defined.

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

### Single-source lists (decision D11)
- AI features: `backend/app/services/llm/features.py` (`AI_FEATURES`: id, label, group, class,
  description, context, context budget). `just gen` renders it into
  `frontend/src/lib/ai/features.generated.ts`; CI fails when that file is stale. A router may
  only pass a `feature=` id that is in the table (`tests/services/test_ai_features.py`).
- Keyboard shortcuts: `frontend/src/lib/keyboard/shortcuts.ts` (`matchesCombo`, `formatCombo`). Never
  hard-code a key combo in a component or a title string.
- Story pages: `frontend/src/lib/routes.ts` (More menu, palette nav commands, ModeGate). Grouped pages
  (Lorebook, Compendium, Chronicle) declare `sections` (each a deep link, a More-menu row and a palette
  command with the old page names as keywords) and old paths go in `STORY_REDIRECTS`; bodies live in
  `pages/routeElements.ts`. Every page that is not the prose uses `components/layout/PageHeader`.
- Settings sections: `frontend/src/pages/settings/sections.ts` (side nav, deep links, palette).
- Guides: `frontend/src/guides/index.ts` (+ one `.md` per guide).
`lib/commands/coverage.test.ts` fails when a route, section, shortcut or guide has no palette command.
Navigate from non-React code with `lib/navigation.ts` (`navigateTo`), never `window.location`.

### Undo / redo
Server-side change log (`backend/app/services/change_log.py`, table `changes`). Any route that mutates
story data records a change in the same transaction (`record`, `record_update`, `record_row_create`,
`record_row_delete`, `capture_*`). Prose content edits are logged but not undoable (TipTap history).
Frontend: `hooks/useUndoRedo.ts`; components holding their own copies reload on `UNDO_APPLIED_EVENT`
through `useReloadOnUndo([entity types], reload)` (`reselect` re-points a selected row at the fresh list).

### Writer and Studio modes
`user.settings.ui.mode` is `"writer"` or `"studio"` (`frontend/src/lib/mode.ts`: `useMode()`,
`getMode()`, `setMode()`; saved through `PATCH /api/auth/me`). **Writer mode renders no AI
affordance at all**, not even disabled: guard every AI surface with `useMode() === "studio"`
(header Assistant button, AI panel, selection-toolbar AI entries, `AIFeatureInfoTrigger`,
AI fields in panels). Palette commands in the `"AI"` group are hidden by a registry filter.
Non-AI tools (consistency Checks, quote normalisation, NLP analyses) use `--color-nlp` and
stay available in both modes.

### Manuscript editor
`frontend/src/components/editor/` — `SceneEditor.tsx` is a thin shell over hooks
(`useSceneAutosave`, `useMentionDropdown`, `useSlashCommands`, `useInlineNotes`,
`useMentionHoverCard`) and components (`EditorTopbar`, `DialogueIsolationView`, `panels/*`).
Autosave sends `expected_updated_at`; a 409 means the scene changed elsewhere and the pill
offers Keep mine / Take theirs. Every edit is mirrored to an IndexedDB draft buffer
(`lib/draftBuffer.ts`). `purpose` and `inline_notes` are columns on StructureNode, not
metadata keys.

### Unified AI assistant
All AI tools (interview, what-if, panel, writing coach, etc.) are accessed through a single place: the **Assistant tab** of the side panel (`components/panel/AssistantTab.tsx`, body in `components/ai/AssistantTabBody.tsx`), docked past a divider at the end of the tab strip, icon-only with a session count (doc 11 P5). The header's Feather button, ⌘J and the palette all open that tab. No redundant AI entry points in sub-components (scene editor topbar, etc.). Each session runs as a sub-tab there, preserving conversation history; the whole side panel can dock, float or pop out to its own window (`/panel-window`).

To add a new AI session type: (1) register it in `frontend/src/lib/ai/sessions.ts` via `registerSessionType`, (2) add a `case` in `frontend/src/components/ai/SessionView.tsx`, (3) create a mode component using `AIModeWrapper` as the shell.

### AI UI component patterns

**Never use the `Sparkles` icon for AI buttons.** ESLint enforces this (`no-restricted-imports` in `frontend/eslint.config.js`). The app has established conventions — use them everywhere, without exception.

| Element | Icon | When to use |
|---------|------|-------------|
| Open AI chat / workshop | `Feather` + text label | Open the AI panel to a chat session (conversation, workshop, guide) |
| AI action button (idle) | `Compass` + text label | Trigger inline generation, analysis, or drafting |
| AI action button (active) | `Square` + "Cancel" | While streaming, to abort |
| Attribute generation | `Wand2` + text | Per-field attribute suggestions |
| Feature info modal trigger | `Cpu` via `AIFeatureInfoTrigger` | In every panel/page header that has AI features |
| Transparency trigger | `ShieldCheck` via `LLMTransparencyTrigger` | Next to AI-generated results |

**Button style:** `background: var(--color-ai)`, `color: var(--color-ai-fg)`. Match `.generateBtn` in `StorySummaryPanel.module.css` exactly — that is the canonical reference.

**Text labels are required.** An icon alone is never enough. Label examples: "Draft logline", "Suggest themes", "Generate summary", "Identify conflict". One exception: the side panel's Assistant *tab* is icon-only (Feather + session count) with an `aria-label` and tooltip. It is the panel's own tab, not an action button, and a labelled tab would not fit beside the story tabs.

**`AIFeatureInfoTrigger` is mandatory** on any panel or page that exposes AI features. It renders the `Cpu` icon button that opens `AIFeatureInfoModal`. Place it in the panel header next to the title.

**Assistant actions on a Lorebook sheet** fold into its one `AssistantRow`; on a page they sit in the
header's ⋯ menu (AI colour, Compass), never as buttons across the page.

**`LLMTransparencyTrigger`** (`ShieldCheck`) must appear next to AI-generated content so the author can inspect what was sent to the model. Use the `useLLMTransparency` hook.

**Register every new AI feature twice**: first as a row in `backend/app/services/llm/features.py`
(the gateway rejects nothing, but the tests do), then as a surface in
`frontend/src/lib/ai/registry/<page>.ts` listed under the right `pageId` in `featureRegistry.ts`.
One backend feature can have several surfaces — "Suggest Location Elements" and "Suggest Cultural
Elements" are both `element-suggest` — which is why the surface copy is hand-written. Format:
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
cd backend && uv run python -m pytest -v   # direct (not `uv run pytest`: its shebang breaks when the repo moves)
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
- `db_session` — In-memory SQLite session (foreign keys ON) for isolated DB tests
- `client` — TestClient with `get_db` and `get_current_user` overridden; no lifespan
- `mock_ai_gateway(...)` — Patches `ai_gateway` in every router module (auto-discovered)
- `mock_thread(...)` — Factory for PlotThread-like objects
- `tests/fixtures/story_factory.build_full_story` — one row in every story-owned table
- Bug fixes get a regression test first: `tests/routers/test_regressions_stage0.py` is the pattern

## Feature Tracking

See `FUTURE_FEATURES.md` for the full backlog. When implementing any item:
1. Mark it `[x]` with a brief description of what was built
2. Update the seed demo story to demonstrate the feature
3. Update the "Last updated" line at the bottom of the file
