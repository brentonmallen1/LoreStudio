# LoreStudio

**A writer support platform, not an AI content generator.** The author writes; LoreStudio helps
them plan, organise and understand the story through structured data, local analysis and
optional AI. Every feature should help answer "what is this story, why does it exist, and where
is it going?", never write it for them.

Backend detail is in `backend/CLAUDE.md`, frontend detail in `frontend/CLAUDE.md`; the visual
rules are in `DESIGN.md`.

## Principles

- **Informative, not intrusive; warm and minimal.** The UI serves the writing and stays quiet.
- **Author intent is data.** Purpose, synopsis, arcs and narrative intent matter as much as prose.
- **Structured flexibility.** Structure is a template (named levels) over a `StructureNode` tree.
- **Transparent, proactive, never presumptuous.** Background work and every AI call are logged and
  visible; the system prepares data and flags issues but never acts without permission.

Vocabulary, used in code, UI and docs: **Lorebook** (canon: characters, places, themes, intent),
**Manuscript** (the prose), **Compendium** (research and reference), **Codex** (the AI's
knowledge: graph, embeddings, index), **Chronicle** (history: conversations, analyses, logs).

## Commands

```bash
just dev        # backend :8000 + frontend :5173
just setup      # uv + npm installs
just ci         # exactly what GitHub CI runs; run it before pushing
just fix        # auto-fix and format both halves
just test       # backend tests
just db-check   # models and migrations agree
just gen        # regenerate frontend/src/lib/ai/features.generated.ts
```

Quality gates are ratchets and only tighten: the file-length budget (`scripts/check-size.py`), the
design-token budget (`scripts/check-tokens.py`), backend coverage `fail_under`, the Vitest
coverage thresholds, and the ESLint warning cap. Never raise a debt number to get green.

`main` is protected: changes land through a pull request with green checks.

## Rules that cross both halves

- **Writer mode shows no AI at all**, not even disabled (`useMode() === "studio"` guards every AI
  surface). Non-AI tools (checks, NLP) stay in both modes.
- **Colour:** never hard-code one; use `var(--color-*)`. AI is `--color-ai` (purple), local NLP is
  `--color-nlp` (teal), never the accent.
- **Undo:** every route that changes story data records a change in the same transaction, or is
  listed in `NOT_UNDOABLE` with its reason. ⌘Z is one timeline across the editor and the server.
- **A new AI feature** is a row in `backend/app/services/llm/features.py` and a surface in
  `frontend/src/lib/ai/registry/`.
- **Long work is a job** (`services/job_queue.py`); **anything automatic** registers in
  `services/automatic.py`.
- **Schema changes come with an Alembic migration** in the same change.
- **Test as you build:** pure logic gets unit tests; a bug fix starts with a failing test.
- **Shipping a feature:** tick it in `notes/FUTURE_FEATURES.md` with a line on what was built,
  update its "Last updated" line, and show the feature off in the demo story, "The Last
  Lighthouse" (`services/seed.py`).

Planning docs live in `notes/refactor-2026-09/` (gitignored): read `CHECKLIST.md` before starting
planned work.
