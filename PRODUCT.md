# Product

## Register

product

## Users

Novelists and worldbuilders who do the writing themselves. They range from a serious
novelist on a long project (hours at a time, a big cast, several books in one world) to a
hobbyist who opens it a few evenings a week. Both are usually alone, at a desk or a laptop,
in long stretches of concentration. The prose is the work. Everything else (the Lorebook,
the plan, the findings, the numbers) is consulted beside it and then put away.

The primary task on almost every screen is one of three: write the scene, check something
true about the story, or decide what to do next. Screens that are not the prose are
reference and planning, visited briefly, then left.

## Product Purpose

LoreStudio is a writer support platform, not an AI content generator. It helps authors plan,
organise and understand a story with structured data: the canon (Lorebook), the prose
(Manuscript), research (Compendium), the system's learned picture of the story (Codex) and
the record of everything done (Chronicle). The human writes; the tool helps them see what
they are building: what this story is, why it exists, where it is going.

Two modes. **Writer** shows no AI at all, not even a disabled control. **Studio** adds an
Assistant that reads the story and answers in conversation, always showing what it was sent.

Success: the author forgets the tool while writing, and trusts it completely when they look
up. Nothing happens behind their back; nothing is decided for them.

## Brand Personality

**Intentional. Refined. Quiet.**

A professional studio: craft-forward, warm, trustworthy, no-nonsense. The kind of tool a
serious author would pay for and feel proud to keep open. Copy is plain and specific ("Who
is on the page", "What needs your eye"), never cute, never salesy, never about the AI.

## Anti-references

- Generic SaaS dashboards: hero metrics, identical card grids, KPI tiles with gradient
  accents.
- AI-tool aesthetics: dark mode with glowing purple or cyan, sparkles, "magic" language.
- Feature-forward UIs that look like product screenshots: every capability on screen at once.
- Notion, Scrivener and iA Writer are not the model; LoreStudio should feel like its own
  thing among writing tools.

## Design Principles

1. **The prose is the room.** Writing is where the author is; everything else opens beside
   it and folds away. Chrome recedes while writing.
2. **Informative, not intrusive.** Surface what helps at the moment it helps. Progressive
   disclosure over completeness on screen.
3. **Color is signal.** Every hue has a job: accent for the author's actions, purple for the
   Assistant, teal for local analysis, palette slots for characters, places and threads,
   status colours for draft state. Decoration dilutes the signal.
4. **Typography carries the weight.** A writing tool is judged on type. Hierarchy and rhythm
   do most of the design work; boxes and borders do as little as possible.
5. **Transparent, never presumptuous.** Every automated thing is visible and reversible.
   The tool prepares; the author decides.

## Accessibility & Inclusion

- WCAG 2.2 AA. Every palette (seven, each light and dark) is held to AA by
  `frontend/src/themes/contrast.test.ts` in CI.
- Full keyboard use: every shortcut lives in one table and appears in the palette; dialogs
  trap focus and restore it.
- Never encode meaning in colour alone: scene state is also a shape (planned dashed, draft
  hollow, revised filled, final ringed).
- Respect `prefers-reduced-motion`; motion is for state changes only.
- Desktop first; small screens get a notice and a usable, not complete, layout.
