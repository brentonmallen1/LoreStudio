An application that enables writers to organize their novels, with seemless integration of llms for character interviews, etc.

Here's my request to chatgpt to make a loveable prompt:
```
actually, why don't you help me write up a very detailed prompt that I can send to loveable to generate a new application. The application should have the following features:
- a overall outline view
- support both discovery writing and outlining methods
- outlining interface, maybe employing the snowflake method
- a place to add characters and accompanying details and traits about them and relationships to other characters. support for other general notes too
- a text editor that has features for organizing text into chapters/scenes/etc
- a chapter/scene/etc interface with note cards for each of those
- support for llm interactions using ollama
- each element of the application is geared towards llm integration to help facilitate writing. The goal isn't to have the novel written for them but only to assist in ideation.
- There should also be a section for the user to add a description/intent of the novel to serve as the overall system prompt for the llm in the context of the novel.
- The app should allow for managing multiple novels with a high level dashboard.
- There should also be appropraite settings for a light and dark theme, connection to the llm, etc.

The idea is that the application should help organize thoughts, notes, writing for managing context to go into the llm interface. there should be a chat interface and the app should be able to manage context by pulling in the relevant details depending on what is being asked, or what section the user is currently writing in/on.  For example, if the user is writing in a chapter that involves certain characters, when interacting with the llm chat, it should have the context for the current section of the novel, the overall outline, the details from each character's details, and any other system level prompt that the user has provided. There should also be a 'character interview' or 'characters group interview' feature so that the user can directly interact with their characters. This would pull in the character(s) context from their description data.

The application should have an overall modern, minimal feel to be intuitive to the user and also as distraction free as possible. the application should feel like an extension of the user not a tool that they need to adapt to use
```
Here is the prompt to lovable:
```
Title: “LoreStudio” — a modular, distraction-free novel-crafting studio with deep LLM assist

Objective  
Design a modern, self-hostable web application that helps fiction writers organize, draft, and iterate on novels while leveraging a locally-run LLM (Ollama).  Every surface of the UI should feel like an unobtrusive extension of the author’s thought-process, not a conventional “tool”.

Core functional scope  
1. **Dashboard** – high-level view of all projects (multiple novels) with progress bars, last-edited timestamps, and quick-launch links.  
2. **Outline & Discovery Workflows**  
   - Snowflake-method-inspired hierarchical outline builder (expands 1-sentence → 1-paragraph → scene list, etc.).  
   - “Discovery Mode” freeform canvas for mind-mapping plot ideas; nodes can be promoted into outline items.  
   - Two-way sync: changes in either view propagate to the other.  
3. **Character & Lore Vault**  
   - Per-character sheet: name, bio, traits, goals, motivations, arc notes, relationships (graph edges).  
   - Generic note sheets for world lore, settings, objects, etc.  
   - Relationship visualizer graph (D3 or Cytoscape).  
4. **Manuscript Editor**  
   - Markdown/WYSIWYG hybrid that stores blocks tagged as **chapter / scene / snippet / note card**.  
   - Scene board: draggable note cards grouped by chapter; inline word-count and status (draft / revised / final).  
5. **LLM Console**  
   - Chat panel dockable beside any workspace.  
   - Context-engine auto-assembles a prompt from:  
     • novel description/intent (global “system” prompt)  
     • current outline branch or discovery canvas selection  
     • active chapter/scene text  
     • active character sheets (if referenced)  
   - Modes: “Brainstorm”, “Rewrite”, “Character Interview (solo)”, “Panel Interview (multi)”.  
6. **Settings**  
   - Theme toggle (light/dark, prefers-color-scheme aware).  
   - Ollama endpoint URL, model name, temperature, max tokens.  
   - Autosave interval, backup path.  

Technical/architectural directives  
- **Clean Architecture** with clear domain/application/interface layers; each major feature shipped as an independent module and exposed via a plugin registry.  
- Front end: React + TypeScript + Vite, Tailwind CSS (utility-first, minimal custom CSS).  
- State: Zustand or Redux Toolkit; persist critical slices (localForage).  
- LLM API abstraction in a single service (`packages/llm-client`) hiding Ollama specifics; future models only require a new adapter.  
- Node (Fastify) back end with Postgres via Prisma.  REST+WebSocket for real-time sync; background workers (BullMQ) for heavy context-assembly.  
- Everything containerised: `docker-compose.yml` spins front end, back end, db, and Ollama together; `.env` for secrets.  
- Testing pyramid:  
  • unit (vitest/jest) for pure functions and reducers  
  • component tests (Playwright)  
  • e2e flows (Cypress) against the compose stack  
- CI: GitHub Actions → build, test, docker-publish, storybook deploy.  
- Code style: ESLint + Prettier + strict TypeScript (`noImplicitAny` etc.).  
- Internationalisation scaffold via i18next; RTL-safe layouts; WCAG 2.1 AA contrast checks.  

UX & visual tone  
- “Paper-white” and “Ink-night” themes; smooth 120 ms motion-reduced transitions.  
- Command-palette (`⌘K`) to jump anywhere or run actions.  
- Editor in “focus mode”: hide sidebars, show progress bar + word count.  
- Keyboard-first: every primary function reachable without mouse.  

Deliverables Loveable must output  
1. Complete monorepo scaffold following the structure:  
apps/
lorestudio-web/
lorestudio-api/
packages/
llm-client/
ui-components/
…
2. Storybook with all UI atoms/molecules documented.  
3. Seed script that inserts a sample novel with outline, characters, and scenes.  
4. 90 % test coverage baseline and GitHub Actions badge.  
5. Setup docs (≤ 1500 words) + architecture diagram (SVG).  

Stretch goals (nice-to-have)  
- Offline-first support via Service Worker & IndexedDB.  
- Optional “focus timer” to encourage distraction-free writing.  
- Plugin hooks for export (ePub, docx) and import (Scrivener, Obsidian).  

Constraints  
- No proprietary SaaS; all open-source dependencies.  
- Privacy-first: zero analytics, local-only model inference.  
- Adhere to DRY/SOLID; no magic-string prop drilling; prefer composition over inheritance.  
- Function names, folder names, and commit messages should “scream” the domain (“novel”, “scene”, “character”).  
```

Ideas:
- Simple database using sqlite
- knowledge graph support for helping to manage context
	- could be done by tags?
- Command palette for not needing to remove fingers from keys navigation
- need for export as various different formats
	- Maybe need to go from a structured interface to a combined output. thinking of the user having different sheets per chapter/scene and then a map of how those are built out, so upon export it becomes one cohesive text
- Commercial llm api support
- A visual approach to context management or view into context?
- the chat interface should show from where context is being pulled in for the current body being worked on as well as the chat. something like cursor approach but an automatic one based on what's being asked or the context of the current scene/chapter
- todo management, brainstorm, stream of consciousness space
- **Interview this character** feature that pulls in the characters metadata into a prompt that tells the llm that is this character and to respond as if it was them given their experiences, personality traits, etc
