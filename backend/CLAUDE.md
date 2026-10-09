# Backend (FastAPI, SQLAlchemy, SQLite)

Run tests with `uv run python -m pytest` (not `uv run pytest`: its shebang breaks when the repo
moves). Configuration is `app/config.py` reading `.env` (see `.env.example`).

## Database

- **Alembic is the only schema path.** `app/services/db_migrate.py` migrates on startup (fresh,
  adopted or upgraded; `docs/upgrading.md`). A model change ships with its migration:
  `uv run python -m alembic revision --autogenerate -m "…"`, then `just db-check`.
  Migrations use `render_as_batch=True` (SQLite cannot ALTER in place).
- SQLite runs with foreign keys on and WAL. Every child table of Story needs an ORM cascade or a
  nulling relationship (`test_delete_story_leaves_no_orphans` walks the metadata) and a snapshot
  key (`SNAPSHOT_KEYS_BY_TABLE` in `services/snapshot_service.py`).
- `just db-reset`, then start the backend: migrations and seeds run on start. The admin,
  templates and beat sheets always seed; "The Last Lighthouse" when `SEED_DEMO=true` and there
  are no stories; the other demos with `SEED_EXTRA_DEMOS=true`. Seeds are idempotent.

## Undo

`services/change_log.py`: a mutating route records in the same transaction (`record`,
`record_update`, `record_row_create`, `record_row_delete`, `capture_*`). Anything that rewrites
prose (replace, quotes, a finding's fix, tags, a rename) goes through `rewrite_prose` /
`prose_writer` and undoes as one batch. A response that recorded carries `X-Change-Batch` and
`X-Change-Story` (`services/change_headers.py`). `tests/test_undo_coverage.py` fails on a route
that neither records nor sits in `NOT_UNDOABLE` with its reason.

## Jobs and automatic work

- Work over the whole story, many scenes or many calls is a job: `@handler(kind, lane=, stop=,
  quiet=, unique=)` in `services/job_queue.py`, queued with `enqueue`. Lanes: `model` (one call at
  a time) and `local` (never waits on the model).
- Every model call passes `services/llm/gate.py`: a live reply preempts a job's call (the job
  requeues at the front, then a cool-down) unless the author's model answers several at once
  (`gate.parallel_for`). Live replies are listed at `GET /jobs/live` and stopped through it.
  A kept stream runs to the end after its window closes (`llm/sse.py`, `carry_on`).
- Anything LoreStudio does by itself is a task in `services/automatic.py` (`TASKS`): check
  `automatic.is_on(db, id)` first, `record_run` after, and give housekeeping a `job_kind`.

## AI

- `services/llm/features.py` (`AI_FEATURES`) lists every feature; a router may only pass a
  `feature=` id from it (`tests/services/test_ai_features.py`). `just gen` writes the frontend copy.
- The model is Gemma 4 on Ollama (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`); without it, AI features
  fail and everything else works.
  - **Thinking** is `<|think|>` at the head of the system prompt. Settings › Model parameters
    chooses Off, Where it helps (`AIFeature.thinks_first`) or Always; a conversation's own
    setting wins.
  - **History:** thought blocks are never re-sent (`ollama.strip_thoughts_from_messages`).
  - **Images:** they go before the text.
- A character interview uses the character's full profile as the system prompt: the model is the
  character, not someone describing them.
- Streaming endpoints return `StreamingResponse`; the client reads the raw body.

## Auth

JWT (PyJWT, HS256), 7-day tokens; passwords hashed with `bcrypt` directly, cut to its 72 bytes (`auth/utils.py`).

## Tests

- `conftest.py` provides `db_session` (in-memory SQLite, foreign keys on), `client` (auth and DB
  overridden, no lifespan), `mock_ai_gateway(...)` and `mock_thread(...)`.
- `tests/fixtures/story_factory.build_full_story` puts a row in every story-owned table.
- Regression tests follow `tests/routers/test_regressions_stage0.py`.
- Don't mock model replies: AI behaviour is checked by hand.
