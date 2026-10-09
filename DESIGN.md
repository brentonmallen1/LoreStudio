---
name: LoreStudio
description: A quiet, warm writing studio that keeps a story's canon beside its prose.
colors:
  parchment: "#f7f6f3"
  paper: "#ffffff"
  vellum: "#f0efe9"
  vellum-deep: "#e8e7e0"
  tone: "#f5f4f0"
  rule: "#e0ded7"
  rule-light: "#ebe9e2"
  ink: "#1a1916"
  ink-muted: "#6a675f"
  ink-subtle: "#6e6c65"
  forest: "#3a6c49"
  forest-deep: "#3d6a4a"
  assistant-violet: "#765783"
  analysis-teal: "#016c76"
  editorial-teal: "#106d66"
  danger: "#b42e30"
  warning: "#835913"
  success: "#056f4f"
  status-planned: "#64625b"
  status-draft: "#835913"
  status-revised: "#016c76"
  status-final: "#056f4f"
  slot-1: "#2668c4"
  slot-2: "#c94f1e"
  slot-3: "#1a9272"
  slot-4: "#7040b8"
  slot-5: "#b07c10"
  slot-6: "#b83670"
  slot-7: "#2a8a9a"
  slot-8: "#5a6a82"
typography:
  page-title:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "1.45rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  prose:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.73rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  button-assistant:
    backgroundColor: "{colors.assistant-violet}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "5px 10px"
  button-ghost-hover:
    backgroundColor: "{colors.vellum}"
    textColor: "{colors.ink}"
  tone-box:
    backgroundColor: "{colors.tone}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  view-switch-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.pill}"
    height: "28px"
  sheet-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  page-plane:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
  page-header:
    backgroundColor: "transparent"
    padding: "18px 20px 14px"
---

# Design System: LoreStudio

## 1. Overview

**Creative North Star: "The Writer's Desk"**

A well-kept desk in a quiet room: the manuscript in the middle, the notebook and the map of
the world within reach, nothing else on it. The prose sits on paper-white in a serif; the
tools around it are in a small, clear sans and step back until they are needed. The left
edge holds the story's shape as a transit line; the right holds whatever the author has
pulled out to look at. Everything that is not the prose is reference: legible at a glance,
then gone.

Density is moderate and calm. Type and space first, a tone box second, a line almost never.
The chrome (the header, the strip, the panel's rail) floats on the page ground with no
background and no border of its own; the prose page and the side panel are paper planes
set on that ground. Colour is rare and always means something. Seven palettes (Zen, Nord, Catppuccin,
Gruvbox, Solarized, Dracula, E-ink), each in light and dark, share one set of token names;
Zen light is the canonical design and dark is an intentional inversion, not the default.

This system rejects the SaaS dashboard (hero numbers, KPI tiles, identical card grids), the
AI-tool look (dark with glowing purple or cyan, sparkles, "magic"), and the product
screenshot that shows every feature at once.

**Key Characteristics:**
- Serif for the author's words and page titles; sans for every tool.
- Warm tinted neutrals; one accent (forest) for the author's own actions.
- Meaning colours with fixed jobs: violet is the Assistant, teal is local analysis.
- Entities carry a palette slot (`--cat-1` to `--cat-8`), scenes a status colour and shape.
- Floating chrome on the page ground, the page and panel as quiet planes; shadows only for
  things lifted off the desk.
- What you can press gets a ground under the pointer; what you read never does.

## 2. Colors: The Parchment Palette

Warm, low-chroma neutrals with a handful of signal colours, each assigned one job.

### Primary
- **Forest** (#4a7c59): the author's own actions: primary buttons, focus rings, the
  selected item, links. Never used for anything the Assistant does.

### Secondary
- **Assistant Violet** (#8566a1): every AI surface and only AI surfaces: Assistant buttons
  (Orbit, Feather), the Assistant tab's tint, AI-sourced findings. Never appears in Writer
  mode.

### Tertiary
- **Analysis Teal** (#2a8a9a): deterministic local analysis (spaCy checks, quote
  normalisation, prose metrics). Present in both modes.

### Neutral
- **Parchment** (#f7f6f3): the page ground, behind everything. The header, the strip and
  the panel's rail sit on it directly.
- **Paper** (#ffffff): the planes the author works on: the prose page, the side panel,
  menus, sheets.
- **Tone** (#f5f4f0, `--color-tone`): the tone box, a quiet ground that groups things on
  a plane ("In this scene", a menu's footer) where a rule or a card used to.
- **Vellum** (#f0efe9) and **Vellum Deep** (#e8e7e0): the hover ground (`--color-hover`
  is the vellum), chips and segmented controls; deep vellum for what is pressed or
  selected.
- **Rule** (#e0ded7) and **Rule Light** (#ebe9e2): the edge of a card that is still a
  card, and the hairline between rows of a long list. Never between regions.
- **Ink** (#1a1916), **Ink Muted** (#6a675f), **Ink Subtle** (#6e6c65): text in three
  steps: content, secondary, metadata. All three read at AA; the steps are carried by size
  and weight as much as by tone (doc 17).

### Signal sets
- **Palette slots** `--cat-1` to `--cat-8` (blue, rust, green, violet, ochre, rose, teal,
  slate in Zen), each with a `-fg` partner: one per character, place or thread, chosen by
  the author and stored on the row.
- **Status** planned (#64625b), draft (#835913), revised (#016c76), final (#056f4f):
  always paired with a shape.
- **Danger** (#b42e30), **Warning** (#835913), **Success** (#056f4f): outcomes only.
- **Control border** `--color-control-border` (#8a8985): the edge of an input, select or
  toggle, 3:1 against every ground. **Focus** `--color-focus` (#4a7c59): the keyboard ring.

### Named Rules
**The One Job Rule.** Every hue has exactly one meaning. Violet is the Assistant; teal is
local analysis; forest is the author. If a colour would need a legend to explain a second
meaning, use a different device.

**The Token Rule.** Colours are written only as `var(--color-*)`, `var(--cat-*)` or
`var(--status-*)`. Token values are hex, defined in every palette's light and dark block
(each palette declares every token Zen's `:root` does, so nothing falls through), and held
by `contrast.test.ts`. `scripts/check-tokens.py` fails on a hex or named colour in a
component (the theme swatches and diagrams are the locked exceptions).

**The AA Rule.** All text reaches 4.5:1 on every ground it sits on: the page ground and
the chrome on it, the paper planes and cards, tone boxes, hover grounds, and a 12% tint of
its own colour (badges and pills). Slots, control edges and the focus ring reach 3:1. Quiet
comes from colour, never from `opacity` on text.

## 3. Typography

**Display Font:** Merriweather (with Georgia, serif)
**Body Font:** DM Sans (with system-ui, sans-serif)
**Label/Mono Font:** ui-monospace (SF Mono, Menlo) for code and shortcuts only

**Character:** A sturdy reading serif for the author's words and the names of things, set
against a friendly, compact grotesque for every tool. The pairing says "manuscript on a
desk", not "app".

### Hierarchy
- **Page title** (Merriweather 400, 1.45rem, 1.15): one per page, in the page header.
- **Prose** (Merriweather 400, the writing size, 1.95): the manuscript, 48, 60 or 76ch
  of the prose font. Sized in px from its own setting: the interface size never moves it.
- **Headline** (DM Sans 600, 1.1rem, 1.3): section headings inside a page.
- **Body** (DM Sans 400, 0.875rem / 13px, 1.5): primary UI text.
- **Label** (DM Sans 600, 0.73rem / 11px, 0.04em): card titles, metadata, counts. Sentence
  case.

The type scale is `--text-xs` to `--text-xl` on a 15px root at the Default interface size.
**Interface size** (90, 100, 110, 125%) scales the root through `--ui-scale`; sizes, spacing,
control boxes and container breakpoints are rem, icons follow by `zoom`, and
`--header-height` is the one header height.

### Named Rules
**The Serif Belongs to the Story Rule.** Merriweather is for the prose, page titles and
entity names. Controls, menus and data are always DM Sans.

**The Floor Rule.** No interface text below `--text-xs` (11px at Default);
`themes/typeFloor.test.ts` holds it. Graph labels inside fixed shapes are the exception:
the graph zooms.

## 4. Elevation and Separation

Flat by default, and quiet. The chrome (the header, the story strip, the panel's rail)
floats on the parchment ground: no background of its own, no border, no rule under it.
The prose page and the side panel are paper planes set on that ground, with a 14px radius
and a small gutter between them, and no border or shadow: the change of tone is the edge.

Inside a plane, separation comes in this order:
1. **Type and space.** A label in the section-title colour, then the value; a heading set
   bolder; more space between groups than within them. This does most of the work.
2. **A tone box.** When a few things belong together and space alone does not say so, they
   sit in a tone box (`--color-tone`, 10px radius, 12px by 14px padding). One level only:
   never a tone box in a tone box.
3. **A line, almost never.** A hairline divides rows of a long list (Findings, Chronicle)
   and nothing else. Never between regions, never round a group, never under a header.

Shadows appear only on things that float above the desk: popovers, menus, the palette,
dialogs, the floating panel, peek cards.

### Shadow Vocabulary
- **Hairline lift** (`0 1px 2px rgba(0,0,0,0.05)`): pressed chips, small toggles.
- **Resting float** (`0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)`): popovers,
  hover cards, menus.
- **High float** (`0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)`): dialogs,
  the command palette, the floating side panel.

### Named Rules
**The Desk Rule.** Nothing on the desk casts a shadow; only what is lifted off it does.

**The Floating Chrome Rule.** The header, the strip and the rail have no ground of their
own. If a piece of chrome seems to need a background or a border to hold together, it has
too much in it.

**The Press Rule.** Everything pressable gets a ground when the pointer is on it (the hover
ground, `--color-hover`), and nothing else does. Fields are the only things with an
outline. Something you only read has no ground, no outline and no accent colour, ever: a
status is a shape and a word, a figure is a number and its label.

## 5. Components

### Buttons
One look per tier, everywhere:
- **Primary:** forest fill, paper text. One per view at most ("Continue writing").
- **Assistant:** violet fill, `--color-ai-fg` text, Orbit (runs an action) or Feather
  (opens a chat) icon plus a text label. Studio only.
- **Ghost:** the quiet tier, and the default. No fill and no border at rest, ink-muted
  text or icon; the hover ground and ink under the pointer; deep vellum while pressed or
  open. The header's controls, the strip's, ⋯ menus, a menu's rows and a link-like word all
  use it.
- **Link in running text:** forest, semibold, no underline until hovered.
- **Shape:** gently rounded (6px; 8px for a menu row); 32px tall in headers, 28px in rows.
- **Focus:** 2px `--color-focus` outline, 2px offset, on every control (fields too).
- **Target:** at least 24px; a small dot gets a 24px hit area round it. An icon-only
  button has an `aria-label` (`iconButtonNames.test.ts`).

### Chips
- **Style:** vellum pill, ink-muted text, count in a lighter weight.
- **State:** pressed chips invert (ink background, parchment text) like the view switch.

### Cards / Containers
- **Tone boxes** group a few things on a plane (In this scene, a menu's footer, the
  Overview's sections): tone ground, 10px radius, 12px by 14px padding, no border. Never
  nested.
- **Sheet cards**, where something is still a card (a Lorebook entry in a grid): paper,
  10px radius, rule border, label title, 12px by 14px padding. Never nested.
- **Lists and feeds** (Findings, Proposals, Chronicle): rows divided by rule-light
  hairlines, no card per row.

### Inputs / Fields
- **Style:** paper fill, `--color-control-border` edge, 6px radius; fields on a sheet
  read as text until focused. The only outlined thing on screen.
- **Focus:** border shifts to forest, plus the focus ring.

### Navigation
- **The logo menu** (top left): the one place to go from. The story's pages grouped by
  domain, a page's sections as quiet words under it, a count beside what is waiting
  (Findings, Proposals), and a tone-box footer with Guides, Settings, light, dark or
  system, the backup line, the mode and the account. The logo's badge is what is waiting
  on you; a warning dot only when a backup failed or is overdue. ⌘K reaches all of it.
- **Header:** floating, the trail of where you are on the left, and on the right only jobs,
  undo and redo, the scratch pad, focus and "Search or jump", all ghost icons.
- **Story strip** (left): the transit line. Chapters are stations with progress rings,
  scenes are stops shaped by status, and the colour-by key shows only while you hover.
  The colour-by picker sits at the top, so the line runs the strip's full height. Widths:
  line, chapter rows, full tree.
- **Side panel** (right): a paper plane of tabs for This scene, open entities and tools;
  the rail beside it launches them, with the Assistant's Feather and the one collapse.
- **Sub header** (top of the page): the scene's icon, title, status and threads, and ⋯.
  Floating, like the header; in focus mode it is quiet (subtle text) until hovered.
- **Status corner** (bottom right of the page): a save light (green saved, yellow
  unsaved or saving, red offline or conflict) and the word count; a click opens the
  figures for the scene, chapter, book and today, and on a conflict Keep mine / Take theirs.
- **Page header:** a serif title on the page itself, a pill view switch, a summary line,
  and a ⋯ menu for secondary and Assistant actions.

### The Transit Strip (signature)
The story as a line: stations for chapters, stops for scenes, the current position as a
filled marker. Colour by who is on the page, threads, status, beat or findings.

## 6. Do's and Don'ts

### Do:
- **Do** separate things with type and space first, a tone box second, and a line almost
  never.
- **Do** let the chrome float on the page ground, and set the page and panel on it as
  paper planes.
- **Do** give everything pressable a hover ground, and nothing else.
- **Do** give every colour one job (forest is the author, violet the Assistant, teal local
  analysis), and pair status colour with shape.
- **Do** set prose in Merriweather at 640px max, and every control in DM Sans.
- **Do** write labels in sentence case, plain and specific ("What needs your eye").
- **Do** define any new token in all seven palettes, light and dark, and add it to the
  contrast test when it carries meaning.

### Don't:
- **Don't** build a generic SaaS dashboard: no hero-metric tiles, no identical card grids,
  no gradient accents.
- **Don't** use AI-tool aesthetics: no dark-with-glowing-purple-or-cyan, no Sparkles icon,
  no "magic" copy.
- **Don't** put every feature on screen at once; reveal tools when they are needed.
- **Don't** use a coloured `border-left` or `border-right` wider than 1px as an accent stripe.
- **Don't** hard-code a colour, or use violet for anything that is not the Assistant.
- **Don't** nest cards or tone boxes, or add shadows to things that sit on the desk.
- **Don't** put a background, a border or a rule on the header, the strip, the rail or a
  sub header, or a rule between regions.
- **Don't** outline a button, a chip or a group: an outline means a field.
- **Don't** give something you only read a hover ground, an outline or an accent colour.
- **Don't** use em dashes in UI copy.
