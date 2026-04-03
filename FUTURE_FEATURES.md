# LoreStudio - Future Features

This document captures features planned for future phases beyond the MVP.

---

## Overall
MAKE SURE TO DO THE FOLLOWING WHEN IMPLEMENTING THINGS ON THIS LIST:
- when these items are incorporated, we should update the seed story data to show off the new features
- update this document to reflect what has been implemented when it has been implemented

## AI-Powered Features

### Writing Assistance
- [ ] **Scene Brainstorming** — AI suggests scene directions based on current plot and character arcs
- [ ] **"What happens next?"** — Given story context, propose 3-5 possible continuations
- [ ] **Rewrite Suggestions** — Highlight text, ask for alternative phrasings
- [ ] **Tone/Style Adjustments** — Rewrite selections in different tones (darker, lighter, more tense)

### Character Tools
- [x] **Character Narrative Intent** — Author-facing notes about what this character is *for* in the story: their arc trajectory ("will lose faith then rediscover it"), key moments ("betrays the protagonist in Act 2"), thematic role ("embodies the cost of ambition"). Separate from personality/motivation — this is the author's plan, not the character's self-knowledge. Can be hidden from AI character interviews but surfaced for writing assistance.
- [x] **Arc Milestones** — Checkable waypoints for each character's journey: "introduced as antagonist", "first moment of doubt", "turn against former allies", "final choice". Track progress through the planned arc as you write.
- [x] **Group Interview / Panel** — Interview multiple characters at once, they respond in character and to each other
- [x] **Character Attribute Generation** — AI suggests traits, backstory elements, quirks
- [ ] **Character Arc Analyzer** — Visualize character development across scenes
- [x] **Relationship Suggestions** — Based on character traits, suggest potential relationship dynamics
- [x] **Interview Capture / Character Evolution** — When an interview session ends, prompt the user to capture insights from it. The LLM summarizes what was revealed during the conversation (new backstory, contradictions, revealed motivations, etc.) and the user can review and selectively apply these to the character's profile. Captured insights are stored alongside the base form fields as `interview_notes` — a growing record of discovered character depth that augments the original traits without overwriting them. Over multiple interviews, this builds a layered picture of who the character actually is versus who they were described as at the start.

### Story Analysis
- [x] **"The Story So Far"** — Generate summary of story up to current point
- [ ] **Pacing Analysis** — Identify slow/fast sections, suggest adjustments
- [ ] **Plot Hole Detection** — Flag inconsistencies based on story elements
- [ ] **Continuity Checks** - Identify potential breaks in continuity through the story from different perspectives like characters or themes or tense, etc.
- [ ] **Theme Tracker** — Identify recurring themes and their development
- [ ] **First-Pass Editor / Story Health Check** — Deep analysis that compares the written story against stated intent: Are story goals being met? Are character arcs tracking toward their planned milestones? Is the tone consistent with the genre/intent? Flags gaps ("protagonist's flaw hasn't been demonstrated yet"), missed setups, pacing issues, and offers commentary on narrative flow. Requires careful context management — either long-context models (1M+ tokens) or intelligent chunking/summarization. Should surface *what* might be off and *why* relative to the author's stated goals, not just generic writing advice.
- [x] **Perspective Summaries / "Where Are We Now"** — On-demand summarization from different viewpoints:
  - **By structure**: "Summarize Act 1" / "What happened in Chapter 3?"
  - **By character**: "Where is Maya right now in her arc?" / "What has the antagonist done so far?"
  - **By thread**: "Status of the romance subplot" / "What do we know about the mystery?"
  
  Gathers the relevant scenes/content for that perspective, generates a concise summary. Useful for picking up after a break, checking continuity, or seeing if a character has been absent too long. Context strategy: build summaries incrementally as scenes are written, refresh on demand.

- [ ] **Summary Archive** — Save all generated summaries (scene, character journey, story) with timestamps. Browse history to see how understanding of the story evolved. Useful for tracking character development over drafts, comparing early vs. late interpretations, or reviewing how the story has grown.

- [ ] **Story Progression Graph** — Interactive timeline visualization of the story's metrics over its progression:
  - **X-axis**: Story progression (by scene, chapter, word count, or percentage)
  - **Y-axis**: Selectable metrics — tension level, pacing (words per scene), emotional valence, POV character, scene status, thread activity
  - **Vertical markers**: Key moments as labeled lines — inciting incident, midpoint, climax, act breaks, user-defined beats
  - **Overlays**: Plot thread activity bands, character appearance spans
  - **Interaction**: Hover for scene details, click to navigate to that scene, zoom/pan for long works
  
  Helps visualize pacing problems (flat tension for too long), structural imbalance (Act 2 is 60% of the book), and where key beats land relative to expected positions. Compare actual progression against intended story length targets.

### Discovery Writer Support
- [ ] **Passive Story Observation** — As the writer writes, the system quietly observes and infers:
  - New characters appearing in prose
  - Character discoveries/revelations about themselves
  - Emerging themes and motifs
  - Relationship dynamics revealed through dialogue/action
  - Plot events and their implications
- [ ] **Discovery Queue** — A review inbox where inferred elements await writer approval:
  - Each item links to the source passage where it was detected
  - Writer can accept (add to Lorebook), dismiss, or edit before accepting
  - Preserves writer agency while reducing manual bookkeeping
- [ ] **Character Discovery Notes** — When a character learns something about themselves or changes, capture it with source reference. Separate from established traits until writer confirms.
- [ ] **Retroactive Structure Inference** — Analyze written prose to suggest how it maps to story structure (acts, beats, turning points)
- [ ] **"What Have I Written?"** — On-demand analysis of recent writing to surface what the system has noticed
- [ ] **Object Extraction** - When the writer creates a character or scene or whatever during their discovery writing process, a mechanism to help them import that thing into a data object so it can be stored and used in the same way as if it was first defined then written about

### Story Versioning & Health
- [ ] **Story Snapshots** — Save named versions of the entire story state at key milestones
- [ ] **Version Diff View** — Compare any two versions side-by-side:
  - Prose changes (standard diff)
  - Character attribute changes
  - Relationship changes
  - Plot thread status changes
  - Structure modifications
- [ ] **Impact Analysis** — When comparing versions, analyze how changes affected:
  - Pacing and flow
  - Character arc progression
  - Theme consistency
  - Tone shifts
  - Plot thread coherence
- [x] **Story Health Dashboard** — At-a-glance inspection: word counts by status (draft/revised/final), scene status pills, story goals checklist, plot thread status (open/developing/resolved), character screen time & arc milestone progress, absent character alerts, and pacing heatmap (words per scene colored by status). Sidebar "Health" tab, no AI required.
- [ ] **Health Alerts** — Proactive notifications when metrics drift (e.g., "Character X hasn't appeared in 5 chapters")

### Context-Aware Chat
- [x] **Scene-Specific Chat** — Chat assistant with full context of current scene + related elements; streaming responses via Ollama; starter prompts for common queries; "Assistant" button in SceneEditor topbar.
- [x] **Context Preview** — Expandable "Context" panel in the chat showing story title/genre/tone/goals, scene synopsis/purpose/entry+exit state, characters in scene with roles, active threads, and settings.
- [ ] **Selective Context** — Toggle which story elements to include in LLM context
- [x] **Smart Context Assembly** — Auto-includes characters @mentioned in prose, active threads tagged to scene, settings tagged to scene, and sibling scenes for narrative continuity.
- [ ] **Multimodal Chat Support** — Ability to attach images to the chat window for vision-capable models. Use cases:
  - Image analysis: "Describe the mood of this reference photo for my scene"
  - Text extraction: Upload handwritten notes, screenshots, or scanned pages
  - Character visualization: "Does this portrait match my character description?"
  - Setting reference: Analyze reference images for descriptive language
  - Research assistance: Extract information from charts, maps, diagrams
  
  Requires a vision-capable model (e.g., `llava` for Ollama, GPT-4V, Claude with vision). Should gracefully degrade when the configured model doesn't support images — hide the upload button or show a clear message.

---

## Knowledge & Context Infrastructure

### Research & Reference Materials
- [ ] **Research Library** — Dedicated space for supplemental materials that inform the story but aren't story elements: research notes, historical references, source documents, URL bookmarks with auto-fetched titles, uploaded PDFs. Searchable, taggable, attachable to story elements as references. The author's "research folder" within LoreStudio — separate from characters, settings, and scenes.

### Knowledge Graph
- [ ] **Story Knowledge Graph** — Auto-generated graph of all story entities (characters, settings, events, themes, relationships) and their connections. Foundation for RAG-based context retrieval in AI features — the system traverses the graph to find contextually relevant information rather than naively stuffing everything into prompts. Incremental updates as the story evolves. Optional visualization in the UI.
- [ ] **Vector Storage for Embeddings** — Embeddings for semantic search stored via SQLite vector extension (`sqlite-vec` preferred — pure C, no dependencies). Enables similarity search without a separate vector DB. Embeddings generated for: scene prose, character profiles, summaries, research notes. Consider: embedding model selection (local via Ollama or API), chunk strategy, incremental vs batch embedding.
- [ ] **Semantic Search** — Natural-language queries across all story content ("what scenes involve betrayal?", "where does X interact with Y?"). Combines vector similarity (embeddings) with graph traversal (relationships) for context-aware results.

### Background Task System
- [ ] **Task Queue** — Async processing for heavy operations: knowledge graph rebuilds, batch summary generation, continuity analysis, export jobs. Tasks can be scheduled (cron-style: nightly, on story open), triggered on-demand from a UI, or event-driven (after N edits, after an idle period).
- [ ] **Task Dashboard** — UI showing each task's status, last run time, duration, and result. Ability to trigger, cancel, and retry. Configurable schedules.

### Conversation Management
- [ ] **Chat History Archive** — All AI conversations (scene chats, interviews, summaries, analysis) persisted to the database. Browsable by date, type, and context. Full-text searchable. Purpose is transparency — the author can revisit what was discussed and what ideas were explored. Configurable retention via `CHAT_HISTORY_RETENTION_DAYS` in `.env` (default: 90, 0 = forever) with per-user override in settings.
- [ ] **Conversation Sessions** — Named, persistent conversation threads that can be paused and resumed. Each session is tied to a context (a scene, a character, the whole story). Multiple open sessions simultaneously. "Continue this conversation" vs "Start fresh" options. Archive without deleting.
- [ ] **Tabbed Chat Interface** — Multiple simultaneous chat tabs, inspired by VS Code Copilot. Each tab is a session with a context indicator (scene name, character name, "Story"). Quick-switch, close to archive, tabs persist across page refreshes.

### Proactive Intelligence
- [ ] **Background Pre-computation** — System pre-generates summaries, caches common queries, and prepares character journey updates as content changes. Data is ready when the user needs it — no waiting.
- [ ] **Story Health Indicators** — Gentle, unobtrusive badge dots or subtle icons in the sidebar when something might need attention. Never interrupts workflow — just signals that information is available. Clicking opens the Health Report.
- [ ] **Story Health Report** — Dedicated report/dashboard page linked from health indicators. Shows: absent characters (no appearance in N chapters), stale summaries needing refresh, potential continuity gaps, unresolved threads, arc milestones approaching or overdue, and a "what changed since your last visit" briefing.

### Transparency & Logs
- [ ] **Activity Logs Page** — A page in Settings showing all system activity: background task runs (what ran, when, duration, result), AI interactions (prompt context, tokens used, model), automated data changes, and errors/warnings. Searchable and filterable by date, type, and severity. Exportable.
- [ ] **AI Interaction Audit** — Every prompt sent and response received logged with timestamps, token counts, and model used. Surfaced in the Activity Logs page.

---

## Story Structure & Organization

### Story-Level Grounding
- [x] **Lorebook / Overview Panel** — Dedicated space for story-level attributes: genre, tone, themes, central conflict, intended audience. Lives alongside the structure, always accessible.
- [x] **Narrative Intent** — What is this story *about* (not plot, but meaning)? What question is it asking? What should the reader feel at the end? This context can be fed to AI tools to keep suggestions aligned with authorial vision.
- [x] **Story Goals Checklist** — Explicit goals the author wants to hit: "establish the magic system by chapter 3", "foreshadow the betrayal", "earn the emotional climax". Trackable, checkable, referenced during writing.
- [x] **Premise & Logline** — Structured fields for the one-sentence pitch and expanded premise. Useful for staying focused and for eventual querying/submission.
- [ ] **Intended Story Length** — Story-level attribute for target form/length:
  - Flash fiction (<1K), Short story (1-7.5K), Novelette (7.5-17.5K), Novella (17.5-40K)
  - Novel (40-100K), Epic/Saga (100K+), Series (multi-book)
  
  Drives story health features: word count progress, pacing expectations, structural depth warnings. A novelette that's trending toward 50K gets flagged; a novel with only one subplot gets a nudge. Informs AI analysis context.

### Advanced Structure Support
- [x] **Custom Structure Templates** — User-defined story frameworks
- [ ] **Structure Comparison View** — See story mapped to different frameworks simultaneously
- [ ] **Beat Sheet Integration** — Save the Cat, Story Circle, etc.
- [ ] **Snowflake Method Workflow** — Guided expansion from sentence to synopsis to scenes

### Short Story Support
> **Reference:** Mary Robinette Kowal's guest lecture in Brandon Sanderson's BYU creative writing series — covers the MICE quotient and short fiction structure.

- [ ] **Short Fiction Length Templates** — Pre-built templates with word count targets for each form:
  - Flash fiction: <1,000 words
  - Short story: 1,000–7,500 words
  - Novelette: 7,500–17,500 words  
  - Novella: 17,500–40,000 words
  
  Each template includes appropriate structural depth (flash = 1 thread, short = 1-2 threads, etc.).

- [ ] **MICE Quotient Framework** — The four elemental story threads, each with a natural open/close pattern:
  - **Milieu**: Enter an unfamiliar place → Leave/escape/return home
  - **Idea**: A question is raised → The question is answered
  - **Character**: Dissatisfaction with self → Acceptance or change
  - **Event**: Status quo disrupted → New equilibrium established
  
  Tag each story thread by MICE type. Short stories typically focus on 1-2 elements; more threads = longer form needed.

- [ ] **Thread Nesting Validation** — MICE threads must close in reverse order of opening (LIFO — "last in, first out"). If you open Milieu, then Character, close Character before Milieu. The system tracks thread open/close points and flags violations that create structural instability.

- [ ] **Word Count Enforcement** — Visual progress bar toward target word count. Soft warnings when approaching form ceiling. Optional hard mode that won't let you exceed the target without acknowledging the form shift.

- [ ] **Economy Analysis** — AI analysis tuned for short fiction constraints: flag subplots that may not fit the form, identify scenes that don't serve a MICE thread, suggest tightening. Every element must earn its place in short fiction — no room for "setup for later."

- [ ] **Try/Fail Cycle Tracking** — Short stories often use 2-3 try/fail cycles before resolution. Track protagonist attempts and outcomes; ensure sufficient struggle before the climax without bloating word count.

### Segment Intent & State Tracking
- [x] **Segment Overview** — Synopsis and Purpose/Intent fields per segment, editable via the Notes panel in SceneEditor. Auto-saves. Purpose field includes helper text prompting entry/exit state thinking.
- [ ] **Segment State Fields** — Expand the overview with dedicated Entry State, Exit State, and Key Events fields. Currently captured as free-text in Purpose; promote to first-class fields when usage warrants.
- [ ] **State Diff View** — Compare entry vs exit states to visualize transformation
- [ ] **AI Context Integration** — Feed segment intent to analysis tools for better suggestions

### Scene Management
- [x] **Scene Cards / Corkboard View** — Drag-and-drop scene organization
- [x] **Scene Status Workflow** — Draft → Revised → Final with visual indicators
- [ ] **Scene Linking** — Connect related scenes, track callbacks/foreshadowing
- [x] **Timeline View** — Visualize scenes in chronological order (vs narrative order)

### Plot Threads
- [x] **Plot Thread Tracking** — Named storylines that span multiple scenes
- [x] **Thread Status** — Open, developing, resolved
- [x] **Thread Visualization** — See where threads weave through the story (thread weave view: horizontal swimlane diagram showing threads as colored lines through story structure, with interactive hover/toggle)

---

## Editor Enhancements

### References & Links
- [x] **@Mentions** — `@Character` and `[[Setting]]` syntax with autocomplete dropdown, keyboard navigation, and inline color-coded highlighting
- [x] **Hover Cards** — 500ms delay popover showing entity info and excerpt, with "View" button to navigate to character sheet or Lorebook
- [x] **Broken Link Detection** — Unmatched mentions highlighted in amber with "Not found" badge in hover card

### Writing Tools
- [x] **Focus Mode** — Hide all UI, just editor + word count + subtle progress
- [x] **Sprint Timer** — Timed writing sessions (5–30 min) with optional word goal; shows countdown + words written inline in topbar
- [x] **Distraction-Free Fullscreen** — True browser fullscreen via Fullscreen API, combined with sidebar-hiding focus mode; Escape key syncs state

### Formatting
- [x] **Scene Breaks** — `---` horizontal rule with centered decorative glyph via TipTap StarterKit
- [x] **Chapter Headings** — Styled H1/H2 via standard markdown heading syntax
- [x] **Notes/Comments** — Inline author notes stored in `metadata_.inline_notes`; select text + Cmd/Ctrl+Shift+N to annotate; highlights with amber tint + gutter dot markers; clickable popover to read/delete; Notes panel lists all notes with click-to-scroll; excluded from prose content HTML
- [ ] **Version History** — Track changes over time, restore previous versions

---

## Data & Export

### Export Formats
- [ ] **Markdown** — Clean MD with proper structure
- [ ] **Plain Text** — For submission systems
- [ ] **DOCX** — Microsoft Word format
- [ ] **ePub** — E-reader format
- [ ] **PDF** — Formatted manuscript
- [ ] **Fountain** — Screenplay format (if applicable)

### Import Support
- [ ] **Scrivener** — Import .scriv projects
- [ ] **Markdown Files** — Import folder of .md files
- [ ] **Word Documents** — Import .docx
- [ ] **Plain Text** — With structure detection

### Backup & Sync
- [ ] **Automatic Backups** — Scheduled local backups
- [ ] **Export All Data** — Full project archive
- [ ] **Cloud Sync** — Optional sync to personal cloud storage

---

## LLM Provider Support

### Bring Your Own Key
- [ ] **OpenAI** — GPT-4, GPT-4o
- [ ] **Anthropic** — Claude 3.5 Sonnet, Claude 3 Opus
- [ ] **Google** — Gemini Pro, Gemini Ultra
- [ ] **Mistral** — Mistral Large, Mixtral
- [ ] **Groq** — Fast inference
- [ ] **Local Models** — LM Studio, llama.cpp

### Provider Management
- [ ] **Multiple Providers** — Configure several, switch per-task
- [ ] **Cost Tracking** — Estimate/track API costs
- [ ] **Model Recommendations** — Suggest models for different tasks

---

## Collaboration (Future)

### Multi-User Features
- [ ] **User Management UI** — Admin dashboard for users
- [ ] **Row-Level Security** — Database-enforced access control
- [ ] **Shared Stories** — Collaborate on stories with other users
- [ ] **Comments & Feedback** — Leave notes for co-authors
- [ ] **Change Attribution** — Track who wrote what

---

## Visualization

### Relationship Graph
- [x] **Interactive Character Web** — Force-directed SVG graph of character relationships, role-based node sizing, drag to reposition, hover to highlight connections, click to navigate to character sheet
- [ ] **Filter by Type** — Show only certain relationship types
- [ ] **Click to Navigate** — Jump to character from graph (covered by the above)

### Timeline
- [ ] **Story Timeline** — Visual timeline of events
- [ ] **Character Timelines** — Individual character journeys
- [ ] **Parallel Timelines** — For stories with multiple POVs or time periods

### Analytics
- [ ] **Word Count Tracking** — Daily/weekly/monthly progress
- [ ] **Writing Streaks** — Gamification of consistency
- [ ] **Scene Statistics** — Word counts, status breakdown

---

## Settings & Customization

### Editor Preferences
- [ ] **Custom Fonts** — Choose writing font
- [ ] **Line Spacing** — Comfortable reading/writing density
- [ ] **Margins & Width** — Narrow/medium/wide editor
- [ ] **Custom CSS** — For power users

### Themes
- [ ] **Additional Themes** — Sepia, high contrast, custom
- [ ] **Time-Based Theme** — Auto-switch based on time of day

### Keyboard Shortcuts
- [ ] **Customizable Shortcuts** — Remap all commands
- [ ] **Vim Mode** — For those who want it

---

## Quality of Life

### Search
- [x] **Global Search** — ⌘K palette with live search across stories, characters, scenes, settings, and plot threads; results grouped by type with excerpts
- [ ] **Search & Replace** — Within scene or story-wide
- [ ] **Advanced Filters** — By status, date, word count, tags

### Organization
- [ ] **Tags System** — Tag any element for cross-referencing
- [ ] **Collections** — Group stories into series/collections
- [ ] **Archive** — Hide completed/abandoned stories without deleting

### Accessibility
- [ ] **Screen Reader Support** — Full ARIA compliance
- [ ] **High Contrast Mode** — For visual accessibility
- [ ] **Reduced Motion** — Respect prefers-reduced-motion
- [ ] **Keyboard Navigation** — Everything reachable without mouse

---

## Technical Improvements

### Performance
- [ ] **Offline Support** — Service worker + IndexedDB
- [ ] **Lazy Loading** — Load story elements on demand
- [ ] **Optimistic Updates** — Instant UI feedback

### Infrastructure
<!-- - [ ] **PostgreSQL Support** — For larger deployments -->
<!-- - [ ] **Redis Caching** — Session/query caching -->
- [ ] **Background Jobs** — For heavy operations (export, AI batch tasks)

---

## Media & Visual Assets

### Asset Management
- [x] **Media Library** — Central hub (sidebar "Images" tab) for uploading, browsing, and managing images and documents per story. Grid view with thumbnail previews, filter by type (images/documents), drag-and-drop upload, alt text and description editing, copy URL.
- [x] **Asset Attachments** — Polymorphic attach/detach system: any asset can be attached to a character, scene/structure node, or diagram with a role label (portrait, reference, cover, background, inspiration). AssetPicker widget embedded in Character sheet and Scene notes panel.
- [x] **AI Image Analysis** — Sparkle button on image assets streams an evocative narrative analysis of mood, atmosphere, lighting, and setting details via Ollama vision model — useful for extracting descriptive language from reference images.
- [ ] **Inline Image Embeds** — Insert images directly into prose via TipTap extension; render inline in the editor
- [ ] **Image Resizing/Thumbnails** — Server-side thumbnail generation for faster library loading
- [ ] **Character Portrait Display** — Show the "portrait" role attachment prominently at the top of the character sheet; thumbnail next to character name in the sidebar
- [ ] **Corkboard / Timeline Thumbnails** — Show a scene's first attached image as a thumbnail on its corkboard card and timeline entry
- [ ] **Setting/Location Sheet** — Dedicated detail view for settings with portrait attachment, atmosphere notes, and scene references; currently settings live only as a list in the Lorebook
- [ ] **Asset Tags** — Tag assets with free-form labels (e.g. "dark", "autumn", "antagonist") for filtering and cross-referencing across a large library
- [ ] **Bulk Operations** — Select multiple assets to batch-delete or batch-attach to an object
- [ ] **Lightbox Preview** — Click any thumbnail to view full-size before attaching
- [ ] **AI: Image → Character Description** — Upload a character portrait and have the AI draft appearance/personality text to seed the character form fields
- [ ] **AI: Scene Atmosphere from References** — Given images attached to a scene, AI synthesizes a short atmospheric description to seed the prose or synopsis

### Diagrams & Visual Thinking
- [x] **Diagram Object Type** — First-class diagram entity (mindmap or flowchart) stored per story with title, description, type, and full ReactFlow node/edge data. Listed in the Media & Diagrams page alongside uploaded assets.
- [x] **ReactFlow Diagram Editor** — Interactive visual editor with draggable nodes, connect-by-drag edges, inline label editing (double-click), delete with keyboard, zoom/pan controls, and auto-save. Custom styled nodes: rounded pill (mindmap) and bold central node.
- [x] **Attach Diagrams to Story Sections** — Diagrams can be pinned to a structure node as supporting material (`attached_node_id`).
- [x] **Diagram from ⌘K** — "New diagram: [story]" and "Open media library: [story]" commands in the ⌘K palette; new diagram prompts for title and navigates directly to the editor.
- [ ] **Diagram Templates** — Pre-built starting layouts: story arc, character web, scene structure, three-act template, hero's journey beats
- [ ] **Node Colors & Types** — Color-coded nodes per category (character=blue, setting=green, event=amber, theme=purple); sticky-note style text blocks
- [ ] **Image Nodes** — Embed an uploaded asset directly as a node in a diagram (visual mood boards, character webs with portraits)
- [ ] **Diagram Thumbnail in Scene Notes** — When a diagram is attached to a scene, show a small preview card in the Notes panel that opens the editor on click
- [ ] **Diagram Export** — Export as PNG or SVG for use in presentations or external tools
- [ ] **AI: Generate Mindmap from Character** — From a character's full profile, AI generates a mindmap of their relationships, motivations, fears, and arc milestones
- [ ] **AI: Generate Plot Structure Diagram** — From the story's scenes and threads, AI generates a flowchart of plot causality or a character web diagram
- [ ] **Mindmap-to-Outline Promotion** — Convert a mindmap's nodes into story structure nodes (the Discovery Mode "freeform canvas → outline" flow from original notes)

---

## Information Architecture Refactoring

> **Goal:** Organize the application around the five core domains: Lorebook, Manuscript, Compendium, Codex, and Chronicle. Each domain has clear boundaries and a dedicated UI presence.

### Lorebook (Story Canon)
- [x] **Lorebook Panel** — (formerly Story Bible) Characters, settings, relationships, themes, narrative intent, goals
- [ ] **Lorebook Navigation Refactor** — Consider whether characters, settings, and relationships should be sub-sections of the Lorebook rather than separate sidebar tabs
- [ ] **Lorebook Export** — Export the complete Lorebook as a standalone reference document (Markdown, PDF)

### Manuscript (The Prose)
- [x] **Scene Editor** — Where the prose lives
- [x] **Structure Tree** — Acts, chapters, scenes organization
- [ ] **Manuscript View** — A unified, read-through view of the entire manuscript (vs scene-by-scene editing)
- [ ] **Manuscript Export** — Export clean prose without metadata (for submission, beta readers)

### Compendium (Research & Reference)
- [ ] **Compendium Panel** — New top-level section for research materials (see Research Library feature)
- [ ] **Compendium Attachments** — Link compendium entries to Lorebook items or Manuscript scenes as references
- [ ] **Compendium Import** — Bulk import research notes, bookmarks, documents

### Codex (AI Knowledge Infrastructure)
- [ ] **Codex Dashboard** — Visualization of the knowledge graph, embedding coverage, index health
- [ ] **Codex Rebuild Controls** — Manual triggers for re-indexing, re-embedding, graph regeneration
- [ ] **Codex Inspection** — See what the AI "knows" about any entity — its graph connections, similar items, context window preview

### Chronicle (History & Logs)
- [ ] **Chronicle Panel** — New section (likely in Settings or as a top-level tab) for conversation history archive, generated summaries/analyses with timestamps, and activity logs
- [ ] **Chronicle Retention Settings** — Configure how long history is kept, per-category
- [ ] **Chronicle Export** — Export conversation history and activity logs for backup or review

### User Education & Help
- [ ] **Glossary / Terminology Guide** — In-app reference explaining LoreStudio's vocabulary (Lorebook, Manuscript, Compendium, Codex, Chronicle) and key concepts. Accessible from help menu or settings.
- [ ] **Onboarding Tour** — First-time user walkthrough introducing the five domains, where to find things, and basic workflows.
- [ ] **Contextual Help Tooltips** — "?" icons on panels and features linking to relevant documentation or explanations.
- [ ] **Writing Craft Reference** — In-app access to frameworks like MICE quotient, story structure templates, and other craft guidance — writing education, not just tool docs.
- [ ] **Feature Discovery** — Gentle hints surfacing features the user hasn't tried yet ("Did you know you can interview your characters?").

- [ ] **Guided First Story** — A structured "learn by doing" experience where the user writes their first short story with AI guidance. Not a passive tutorial — they create something real while learning the tool:
  - Uses the Short Story structure (MICE quotient, tight scope) as the framework
  - AI guide with curated "first story" prompts that adapt to what the user is writing
  - Covers the full workflow: Lorebook setup → character creation → structure → writing → revision
  - Progress is persistent — can pause and resume at any time; state stored per-user
  - Milestone checkpoints: "You've defined your protagonist. Next: give them a problem."
  - Completion unlocks a "graduation" moment — their first finished story
  - Optional: AI reviews the finished story against MICE principles, offers gentle feedback
  
  Open design question: How interactive should the AI be? Options range from a static playbook with checkboxes, to a fully conversational guide that reads the user's prose and responds contextually, to something in between (playbook structure + AI prompts triggered at key moments).

---

## Ideas from Original Notes

*Captured from original_notes.md for reference:*

- Knowledge graph support for context management (possibly via tags)
- Visual approach to context management / view into what context is being used
- Todo management, brainstorm, stream of consciousness space
- Discovery Mode freeform canvas for mind-mapping (promotes to outline)
- Relationship visualizer graph (D3 or Cytoscape)
- Command-palette (`⌘K`) to jump anywhere or run actions
- Focus timer for distraction-free writing
- Plugin hooks for export/import
- Segment state tracking (entry/exit states for structure levels)
- Discovery writer mode with passive observation and inference
- Story versioning with diff and impact analysis
- Story health dashboard for at-a-glance inspection

---

*Last updated: 2026-04-03 — Added Knowledge & Context Infrastructure section (Research Library, Story Knowledge Graph, Background Task System, Conversation Management with tabbed sessions, Proactive Intelligence with health indicators/report, Activity Logs). Added design principles to CLAUDE.md: Transparent by default, Proactive not presumptuous, Context as infrastructure.*
