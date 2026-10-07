# Contributing to LoreStudio

LoreStudio is a writer support platform, not an AI content generator: the author writes, and
the tools help them see what they are building. Changes are judged against that first. The full
set of conventions (vocabulary, design rules, AI patterns, how each subsystem works) is in
[CLAUDE.md](CLAUDE.md), the guide for anyone, human or assistant, working in the code. This page
is the short version and the workflow.

## Getting set up

Follow [docs/INSTALLATION.md](docs/INSTALLATION.md): `just init-env`, `just setup`, `just dev`.
Then `just hooks` installs the pre-commit hook (the instant checks, about two seconds).

## Where things are

```
backend/app/
  routers/        FastAPI routers, one per area
  services/       the logic: findings, jobs, the change log, the Codex, the LLM gateway
  models/         SQLAlchemy models; alembic/versions/ holds the migrations
  schemas/        Pydantic request and response models
backend/tests/    routers/ and services/ mirror the app; fixtures/ builds stories
frontend/src/
  pages/          route-level pages (routes in lib/routes.ts)
  components/     by domain: editor, panel, findings, lorebook, promises, numbers, ...
  stores/         Zustand stores
  lib/            pure logic, tested beside it (*.test.ts)
  themes/         one CSS file per palette, held to WCAG AA by contrast.test.ts
aio/              the all-in-one image's s6 services
unraid/           Unraid templates
docs/             for people running LoreStudio
```

## Quality gates

`just ci` runs exactly what GitHub CI runs. Run it before pushing.

| Gate | What it holds |
|---|---|
| `scripts/check-pii.py` | No runtime data (databases, uploads, exports) tracked; no denied personal terms |
| `scripts/check-size.py` | File-length budget. Files over it are locked at their size and may only shrink |
| `scripts/check-tokens.py` | No hard-coded colours, no undefined tokens |
| `scripts/check-docs.py` | Markdown only where it ships; every relative link resolves |
| ruff, ty | Backend lint, format, types |
| pytest with coverage | Backend tests; `fail_under` in `backend/pyproject.toml` is a ratchet |
| prettier, tsc, eslint | Frontend format, types, lint; the warning cap only goes down |
| vitest | Frontend tests |
| `tests/test_migrations.py` | Models and migrations agree |

The ratchets (file sizes, coverage, warnings) move one way. Never raise a lock to get a change
through; make the change smaller or split the file.

## The rules that are not negotiable

- **Colours are tokens.** `var(--color-*)` only; every palette, light and dark, must work. AI
  surfaces use `--color-ai`, local analysis `--color-nlp`.
- **Writer mode has no AI.** Every AI surface is guarded by `useMode() === "studio"`.
- **Every story-data change can be undone.** A route that changes a story records it in the
  change log in the same transaction (`services/change_log.py`); one that should not be undoable
  says why in `tests/test_undo_coverage.py`.
- **A model change comes with its migration** (`just db-revision "add thing"`, then
  `just db-check`).
- **One source for each list**: AI features, shortcuts, pages, settings sections, guides. See
  CLAUDE.md, "Single-source lists".
- **Background work is visible.** Long work is a job; automatic work is registered in
  `services/automatic.py`; every AI call is logged.

## Tests

Test as you build. Pure logic first, then the API contract. A bug fix starts with a failing
test. AI responses are not mocked; AI features are tried by hand against a real model.

```bash
just test                                   # backend
cd frontend && npx vitest run               # frontend
```

## Changes

- Branch from `main`, keep a change to one subject, and run `just ci`.
- Commit messages say what changed for the person using the app and why, in prose: a short
  first sentence, then the detail. `git log` shows the style.
- New features update the demo story ("The Last Lighthouse") so they can be seen working.

## Releases

Maintainers cut releases with `just release 2026.10.1 notes.md` (written notes: features, then
fixes, then smaller things). The tag builds and publishes the images; see
[docs/deployment.md](docs/deployment.md).
