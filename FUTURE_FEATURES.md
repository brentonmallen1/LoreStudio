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

### Discovery Writer Support
- [ ] **Passive Story Observation** — As the writer writes, the system quietly observes and infers:
  - New characters appearing in prose
  - Character discoveries/revelations about themselves
  - Emerging themes and motifs
  - Relationship dynamics revealed through dialogue/action
  - Plot events and their implications
- [ ] **Discovery Queue** — A review inbox where inferred elements await writer approval:
  - Each item links to the source passage where it was detected
  - Writer can accept (add to story bible), dismiss, or edit before accepting
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
- [ ] **Story Health Dashboard** — At-a-glance inspection of overall story state:
  - Arc completion percentages
  - Unresolved plot threads
  - Character screen time balance
  - Pacing heat map
  - Flagged inconsistencies
  - Missing setup/payoff pairs
- [ ] **Health Alerts** — Proactive notifications when metrics drift (e.g., "Character X hasn't appeared in 5 chapters")

### Context-Aware Chat
- [ ] **Scene-Specific Chat** — Chat assistant with full context of current scene + related elements
- [ ] **Context Preview** — Visual display of what context is being sent to LLM
- [ ] **Selective Context** — Toggle which story elements to include in LLM context
- [ ] **Smart Context Assembly** — Auto-include relevant characters, settings based on scene content

---

## Story Structure & Organization

### Story-Level Grounding
- [x] **Story Bible / Overview Panel** — Dedicated space for story-level attributes: genre, tone, themes, central conflict, intended audience. Lives alongside the structure, always accessible.
- [x] **Narrative Intent** — What is this story *about* (not plot, but meaning)? What question is it asking? What should the reader feel at the end? This context can be fed to AI tools to keep suggestions aligned with authorial vision.
- [x] **Story Goals Checklist** — Explicit goals the author wants to hit: "establish the magic system by chapter 3", "foreshadow the betrayal", "earn the emotional climax". Trackable, checkable, referenced during writing.
- [x] **Premise & Logline** — Structured fields for the one-sentence pitch and expanded premise. Useful for staying focused and for eventual querying/submission.

### Advanced Structure Support
- [x] **Custom Structure Templates** — User-defined story frameworks
- [ ] **Structure Comparison View** — See story mapped to different frameworks simultaneously
- [ ] **Beat Sheet Integration** — Save the Cat, Story Circle, etc.
- [ ] **Snowflake Method Workflow** — Guided expansion from sentence to synopsis to scenes

### Segment Intent & State Tracking
- [x] **Segment Overview** — Synopsis and Purpose/Intent fields per segment, editable via the Notes panel in SceneEditor. Auto-saves. Purpose field includes helper text prompting entry/exit state thinking.
- [ ] **Segment State Fields** — Expand the overview with dedicated Entry State, Exit State, and Key Events fields. Currently captured as free-text in Purpose; promote to first-class fields when usage warrants.
- [ ] **State Diff View** — Compare entry vs exit states to visualize transformation
- [ ] **AI Context Integration** — Feed segment intent to analysis tools for better suggestions

### Scene Management
- [x] **Scene Cards / Corkboard View** — Drag-and-drop scene organization
- [x] **Scene Status Workflow** — Draft → Revised → Final with visual indicators
- [ ] **Scene Linking** — Connect related scenes, track callbacks/foreshadowing
- [ ] **Timeline View** — Visualize scenes in chronological order (vs narrative order)

### Plot Threads
- [x] **Plot Thread Tracking** — Named storylines that span multiple scenes
- [x] **Thread Status** — Open, developing, resolved
- [x] **Thread Visualization** — See where threads weave through the story (thread weave view: horizontal swimlane diagram showing threads as colored lines through story structure, with interactive hover/toggle)

---

## Editor Enhancements

### References & Links
- [ ] **@Mentions** — Reference characters, settings, scenes inline (`@Maya`, `[[The Warehouse]]`)
- [ ] **Hover Cards** — Preview referenced element without leaving editor
- [ ] **Broken Link Detection** — Alert when referenced element is deleted

### Writing Tools
- [x] **Focus Mode** — Hide all UI, just editor + word count + subtle progress
- [ ] **Typewriter Mode** — Keep cursor centered, text scrolls
- [ ] **Sprint Timer** — Timed writing sessions with word count goals
- [ ] **Distraction-Free Fullscreen** — Minimal UI, maximum focus

### Formatting
- [ ] **Scene Breaks** — Visual dividers between scenes
- [ ] **Chapter Headings** — Styled chapter markers
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
- [ ] **Global Search** — Find across all stories, characters, scenes
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

*Last updated: 2026-04-01 — Added Segment Intent & State Tracking, Discovery Writer Support, Story Versioning & Health; implemented Thread Visualization and Character Relationship Graph*
