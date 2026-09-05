<!-- 
  Logo placeholder: Replace with actual logo
  Recommended: 400-600px wide, transparent background
-->
<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="LoreStudio" width="400">
</p>

<h1 align="center">LoreStudio</h1>

<p align="center">
  <strong>Where stories take shape.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="docs/INSTALLATION.md">Installation</a> •
  <a href="docs/CONFIGURATION.md">Configuration</a>
</p>

<!-- Badges: uncomment and update when applicable
<p align="center">
  <img src="https://img.shields.io/badge/python-3.13+-blue" alt="Python 3.13+">
  <img src="https://img.shields.io/badge/node-20+-green" alt="Node 20+">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
</p>
-->

---

## What is LoreStudio?

LoreStudio is a self-hosted writing platform that helps you build, organize, and refine your stories. It gives you a place to develop characters, map relationships, track plot threads, structure your narrative, write your prose, and analyze what you've written. All in one workspace.

There are AI tools if you want them. They run locally on your machine through [Ollama](https://ollama.ai), so your work stays private. You can interview your characters to discover who they are, get coaching on a tricky passage, check your pacing, explore "what if" scenarios. You can even ignore the AI entirely and everything else still works.

---

## What LoreStudio is Not

LoreStudio won't write your book for you.

It's not a ghostwriter. It's not a content mill. It won't generate chapters or "finish" your scenes. The AI features are there to help you think through problems, not to think for you.

When you ask for writing help, you get analysis, questions, and suggestions — not replacement prose. Your voice stays your voice. The words on the page are yours.

If you're looking for something that generates content, this isn't it.

---

## Philosophy

**You write. The tools support you.** AI features analyze, question, and suggest. They help you see your story from new angles. They don't put words in your mouth.

**Privacy is the default.** All AI runs locally via Ollama. Your stories never leave your machine. No cloud services, no telemetry, no one training models on your work.

**Transparency, not magic.** Every AI interaction is logged in the Chronicle. You can see exactly what context was sent, what the model returned, and how many tokens it used. No black boxes. If you ever use a commercial model, you'll know precisely what left your machine.

**AI is entirely optional.** Character sheets, plot tracking, worldbuilding, export, versioning — none of it requires AI. The organizational tools stand on their own. AI adds depth if you want it; it's not a dependency.

**Your data belongs to you.** Self-hosted means you control it. SQLite database you can backup, inspect, or migrate. Export to standard formats whenever you want. Built-in versioning keeps snapshots of your work — automatic or manual — so you can compare changes, restore earlier states, or just have peace of mind that nothing is lost.

---

## Screenshots

<!-- 
  Screenshot placeholders: Replace with actual screenshots
  Recommended: 1200px wide, PNG or WebP
  
  Suggested screenshots:
  1. Story workspace with scene editor
  2. Character sheet with relationship graph
  3. Story health dashboard
  4. AI character interview
-->

<p align="center">
  <em>Screenshots coming soon</em>
</p>

<!--
<p align="center">
  <img src="docs/assets/screenshot-workspace.png" alt="Story Workspace" width="800">
  <br><em>The writing workspace with scene editor and story structure</em>
</p>

<p align="center">
  <img src="docs/assets/screenshot-characters.png" alt="Character Management" width="800">
  <br><em>Character profiles with relationship visualization</em>
</p>
-->

---

## Features

### Story Organization

- **Flexible structure** — Acts, chapters, scenes, beats — or define your own hierarchy with custom templates
- **Any story length** — Flash fiction to multi-book epics, with word count tracking and form-appropriate guidance
- **Multiple views** — Tree outline, corkboard for visual planning, timeline for chronological order
- **Beat sheet integration** — Save the Cat, Hero's Journey, Story Circle, or create your own

### Characters & Worldbuilding

- **Rich character profiles** — Personality, motivation, background, arc milestones, narrative intent
- **Relationship mapping** — Track connections between characters with an interactive graph
- **Worldbuilding hub** — Locations, cultures, world systems (magic, technology), historical events, calendars
- **Discovery tracking** — As you write, the system helps identify new characters and settings in your prose

### Writing Tools

- **Distraction-free editor** — TipTap-based rich text with focus mode and sprint timer
- **Smart references** — `@Character` and `[[Location]]` mentions with autocomplete and hover cards
- **Dialogue tracking** — Attribution analysis, character voice distinctness, balance metrics
- **Scene linking** — Connect related scenes (foreshadowing, callbacks, parallels) and visualize the web

### AI Assistant (Optional, Local)

All AI features run through [Ollama](https://ollama.ai) on your machine. Nothing is sent to external servers.

- **Character interviews** — Have conversations with your characters to discover who they really are
- **Panel discussions** — Interview multiple characters together; they respond to each other
- **Writing coach** — Highlight a passage for analysis and suggestions (never rewrites for you)
- **Story analysis** — Pacing, continuity, plot holes, theme tracking, cliché detection
- **What-If simulator** — Explore "what if I killed this character?" with ripple-effect analysis
- **Scene planning** — AI-assisted brainstorming for scenes you haven't written yet

### Export & Versioning

- **Multiple formats** — DOCX, EPUB, PDF, Markdown, HTML, ODT
- **PDF layouts** — Novel, manuscript (Courier double-spaced), compact, dark mode
- **Version snapshots** — Manual or automatic backups with diff comparison
- **Full export** — Download your entire story as a portable archive

---

## Quick Start

### 1. Install Ollama (optional, for AI features)

```bash
brew install ollama
ollama serve
ollama pull gemma4
```

### 2. Clone and configure

```bash
git clone https://github.com/your-username/LoreStudio.git
cd LoreStudio
just init-env
# Edit .env to set ADMIN_PASSWORD and SECRET_KEY
```

### 3. Install dependencies

```bash
just setup
```

### 4. Start the application

```bash
just dev
```

### 5. Open in browser

Visit [http://localhost:5173](http://localhost:5173)

Default login: `admin` / (password from your `.env`)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALLATION.md) | Full setup instructions, Docker deployment, troubleshooting |
| [Configuration Reference](docs/CONFIGURATION.md) | Environment variables, Ollama setup, model recommendations |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.13, FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, TypeScript, TipTap, Zustand, Tailwind CSS |
| AI | Ollama (local), optimized for Gemma 4 |
| NLP | spaCy (local prose analysis) |

---

## Story Types Supported

LoreStudio adapts to your project's scope:

- **Flash fiction** (under 1,000 words)
- **Short stories** (1,000–7,500 words)
- **Novelettes** (7,500–17,500 words)
- **Novellas** (17,500–40,000 words)
- **Novels** (40,000–100,000 words)
- **Epics** (100,000+ words)
- **Series** (multi-book projects)

Word count tracking, pacing guidance, and AI analysis adapt to your chosen form.

---

## License

<!-- Update with your chosen license -->
MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <em>Built for writers who do the writing.</em>
</p>
