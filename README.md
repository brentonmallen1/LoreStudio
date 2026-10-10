<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/lorestudio-logo-dark.svg" />
    <img src="docs/images/lorestudio-logo-light.svg" alt="LoreStudio" width="128" height="128" />
  </picture>
</p>

<h1 align="center">LoreStudio</h1>

<p align="center">
  <strong>Begin with an idea, forge an adventure.<br/>A private workspace for writing your story, organising its pieces and building the world it lives in. A Mac app, or self-hosted on your own server.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="docs/deployment.md">Deployment</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/brentonmallen1/LoreStudio/actions/workflows/ci.yml"><img src="https://github.com/brentonmallen1/LoreStudio/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/python-3.13-3a6c49" alt="Python 3.13" />
  <img src="https://img.shields.io/badge/FastAPI-SQLite-3a6c49" alt="FastAPI and SQLite" />
  <img src="https://img.shields.io/badge/React-19-3a6c49" alt="React 19" />
  <img src="https://img.shields.io/badge/AI-Ollama%2C%20optional-765783" alt="Ollama, optional" />
  <img src="https://img.shields.io/badge/runs%20on-macOS%20%7C%20Docker%20%7C%20Unraid-3a6c49" alt="macOS, Docker and Unraid" />
  <img src="https://img.shields.io/badge/license-AGPL--3.0-6a675f" alt="AGPL-3.0" />
</p>

---

## Why LoreStudio?

**LoreStudio is a place to write.** A quiet editor for your manuscript, with everything a long
story gathers kept beside it: who the characters are, where things happen, what you have promised
the reader, the plan and the research. It comes in three layers, and you use only the ones you
want:

1. **Write.** The editor, the shape of the book, freewriting, versions and export. This is the app.
2. **See what you are building.** Tools that run on your own machine with no model involved: the
   Lorebook, dialogue tracking, prose and pacing checks, promises and insights.
3. **Ask, if you want to.** An optional `Studio` mode  Assistant on your own Ollama. Switch to `Writer` mode and
   every trace of it is gone.

### Not a ghostwriter. Not a co-author. A guide.

LoreStudio does not write your book, and it does not write it with you. It won't draft your
chapters or rewrite your prose. It helps you see: it notices what slipped, keeps track of what you
set up, asks the questions a good editor would, and lets you talk to your characters until you know
who they are. The words, and every choice behind them, are yours.

### Self-hosted, private, yours.

- **On your own machine.** An app on your Mac, or one container on your own computer or server.
  No account anywhere else, no subscription, no telemetry.
- **Private.** The optional AI runs on your own [Ollama](https://ollama.com), so nothing you write
  is sent to anyone else's servers. Every AI call is logged in the Chronicle with exactly what was
  sent and what came back, and everything LoreStudio does by itself is listed, scheduled and
  switchable.
- **Yours.** One SQLite database in one folder. Export to DOCX, EPUB, PDF and more, save and
  compare versions, undo almost anything. The code is open under the AGPL.

## Screenshots

<p align="center">
  <a href="docs/images/screenshots/write-light.png">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/images/screenshots/write-dark.png" />
      <img src="docs/images/screenshots/write-light.png" alt="The manuscript with the story strip and the This scene panel" width="900" />
    </picture>
  </a>
  <br/><em>Writing a scene: the story strip on the left, the scene's plan and findings beside the prose.</em>
</p>

<p align="center">
  <a href="docs/images/screenshots/promises-light.png">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/images/screenshots/promises-dark.png" />
      <img src="docs/images/screenshots/promises-light.png" alt="The Promises tapestry: threads, twists and setups across the book" width="900" />
    </picture>
  </a>
  <br/><em>Promises: every thread, twist and setup across the book, scene by scene.</em>
</p>

<p align="center"><a href="docs/screenshots.md">See more →</a></p>

## Features

### Write

- **A quiet editor** with focus mode, sprints, notes in the margin and a scratch pad.
- **`@Character`, `[[Place]]` and `"…"<Speaker>`** in the prose itself: mentions with hover
  cards, dialogue attributed to whoever says it.
- **The story strip**: the whole book as a line of stops down the side, coloured by status,
  point of view or findings.
- **Any shape**: acts, chapters and scenes or your own levels, from flash fiction to multi-book
  epics, planned with beat sheets, the Snowflake method or MICE threads if you like.
- **Freewrite** for loose writing, with any phrase made into a note, a character or a scene.
- **Versions** you can compare and restore, **undo** for every change to the story, and
  **export** to DOCX (standard manuscript format too), EPUB, PDF, ODT, Markdown, HTML and text.

### Tools that help, with no AI involved

Everything here runs on your machine, works the same in Writer mode, and never sends a word
anywhere.

#### Lorebook: what is true in your story

- **One sheet for every kind of thing**: characters, places, cultures, systems, eras, calendars,
  each with the fields that matter and nothing else in the way.
- **Who they are**: identity, body and mind, what formed them, and the three questions (what do
  they want, why, what stands in the way). Pronoun and name changes reviewed across the manuscript.
- **Relationships, arcs and milestones**, with a web of who is tied to whom.
- **Series**: books that share characters, places and world, each book with its own version of
  them, planned from the start or grown book by book.

#### Dialogue

- **Every line knows its speaker**, explicitly tagged or inferred from who is nearby, and the
  editor marks which is which. Untagged lines are gathered for you to tag in one pass.
- **The dialogue view**: a scene's conversation on its own, as alternating speech bubbles.
- **Each character's lines** on their sheet, scene by scene, with notes on what they mean beneath
  what they say, prose habits in their speech, and how distinct their voice is from everyone else's.
- **Thoughts as well as speech** for first-person and close point-of-view narration.

#### Checks and findings

- **Local prose checks** (spaCy): name slips with a one-click fix, passive voice, adverbs,
  repeated words, said-bookisms, monotonous sentences, tense and point-of-view slips.
- **One feed** for everything the checks notice, along with quiet threads, absent characters and
  empty chapters.
- **Show me the passage**: a finding that quotes your prose opens the scene at those words.

#### Promises: what the reader is waiting for

- **The tapestry**: threads, twists and setups across the book, with what each scene does to them.
- **Twists** with their truth beside what the reader believes, and their clues in reading order.
- **What the reader knows**, scene by scene.

#### Numbers, Compendium and Chronicle

- **Numbers**: words, pacing, thread lanes, who is on the page, dialogue shares and prose habits
  over the whole book, and how they change over time.
- **The Compendium**: research (notes, links, images, diagrams), shared across a series when you
  want it.
- **The Chronicle**: every conversation, analysis and change, kept and searchable.

### The Assistant (optional, local)

It runs on your own Ollama, built around Gemma 4, and it asks and answers rather than writes.
One switch turns it off, and Writer mode removes it entirely.

- **Interview your characters**, alone or as a panel, with the character's sheet as their mind.
- **Ask about the story** with `@mentions` for what you mean; a writing coach on a passage,
  "what if" explorations, scene planning, and pacing, continuity and plot-hole checks that land
  in the same findings feed.
- **The Codex**: the story's knowledge graph and semantic index, so the Assistant reads the right
  passages, not the whole book.
- **Nothing hidden**: every call shows what was sent to the model, and the Chronicle keeps it.

## Getting started

### On a Mac

Download **`LoreStudio_<version>_macos-arm64.dmg`** from the
[latest release](https://github.com/brentonmallen1/LoreStudio/releases/latest), open it and drag
LoreStudio into Applications. It runs as an app in its own window, with no server to set up and
nothing else to install: exports, the writing checks and the demo story are all inside. Only
[Ollama](https://ollama.com), for the optional AI, is separate.

The first time, macOS says it can't verify LoreStudio, because it isn't signed with an Apple
Developer ID. Open **System Settings › Privacy & Security** and click **Open Anyway**
([step by step](desktop/README.md#installing-a-downloaded-build)). After that it opens like any
other app, and new versions install from inside it: *Settings › About and updates › Install and
restart*. Your stories stay in `~/Library/Application Support/app.lorestudio.desktop`.

The app is for Macs with Apple silicon (M1 and later). Windows, Linux and Intel Mac builds exist
but aren't published yet; [desktop/README.md](desktop/README.md) has how to build one.

### On a server

To reach LoreStudio from any browser, or share one install, run it on your own server. The
all-in-one image needs one port and one folder. With Docker:

```bash
docker run -d --name lorestudio -p 8080:8080 \
  -e ADMIN_PASSWORD='a strong password' \
  -v ./data:/data \
  ghcr.io/brentonmallen1/lorestudio:latest
```

Or with Docker Compose, in an empty folder:

```bash
curl -fsSL -o compose.yaml \
  https://raw.githubusercontent.com/brentonmallen1/LoreStudio/main/docker-compose.aio.yml
echo "ADMIN_PASSWORD=a-strong-password" > .env
docker compose up -d
```

Open <http://localhost:8080> and sign in as `admin`. The demo story, "The Last Lighthouse", shows
how everything is meant to be used. For AI, point `OLLAMA_BASE_URL` at your Ollama and
`ollama pull gemma4`.

**On Unraid**, add `https://github.com/brentonmallen1/LoreStudio` under *Docker → Template
Repositories* and install **lorestudio**; see [docs/unraid.md](docs/unraid.md).

Compose files, reverse proxies, backups and every option: [docs/deployment.md](docs/deployment.md)
and [docs/CONFIGURATION.md](docs/CONFIGURATION.md). Updating: [docs/upgrading.md](docs/upgrading.md).

### Develop it

Requires [uv](https://docs.astral.sh/uv/), Node 26 and [just](https://github.com/casey/just).

```bash
git clone https://github.com/brentonmallen1/LoreStudio.git && cd LoreStudio
just init-env      # .env from .env.example
just setup         # dependencies
just dev           # the app on http://localhost:5173
```

[docs/INSTALLATION.md](docs/INSTALLATION.md) has the details; [CONTRIBUTING.md](CONTRIBUTING.md)
the conventions and quality gates.

## Architecture

| Part | What |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy, Alembic, SQLite (WAL) |
| Frontend | React 19, TypeScript, TipTap, Zustand, Vite |
| AI | Ollama, built around Gemma 4; every call through one gateway that logs it |
| Local analysis | spaCy for prose checks; `sqlite-vec` for semantic search |
| Background work | Jobs in two lanes (the model's, one call at a time, and local work); automatic work on a schedule |
| Deployment | An all-in-one image (nginx and the API under s6) or two containers; amd64 and arm64 |

## Roadmap

- The Assistant at the level of a whole series.
- Read-only access for other tools through MCP.
- Concept art from your descriptions, with guardrails and provenance.
- Audio narration of the manuscript.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); `just ci`
runs every check CI does.

## License

[AGPL-3.0](LICENSE). If you run a modified LoreStudio for other people, share your changes.
