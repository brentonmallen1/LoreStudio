---
name: LoreStudio
description: A quiet, warm writing studio that keeps a story's canon beside its prose.
colors:
  parchment: "#f7f6f3"
  paper: "#ffffff"
  vellum: "#f0efe9"
  vellum-deep: "#e8e7e0"
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
    textColor: "{colors.ink-subtle}"
    rounded: "{rounded.md}"
    padding: "5px 10px"
  view-switch-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.pill}"
    height: "28px"
  sheet-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  page-header:
    backgroundColor: "{colors.paper}"
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

Density is moderate and calm. Hierarchy comes from type and space first, tone second, lines
last. Colour is rare and always means something. Seven palettes (Zen, Nord, Catppuccin,
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
- Flat surfaces separated by tone and hairlines; shadows only for things that float.

## 2. Colors: The Parchment Palette

Warm, low-chroma neutrals with a handful of signal colours, each assigned one job.

### Primary
- **Forest** (#4a7c59): the author's own actions: primary buttons, focus rings, the
  selected item, links. Never used for anything the Assistant does.

### Secondary
- **Assistant Violet** (#8566a1): every AI surface and only AI surfaces: Assistant buttons
  (Compass, Feather), the Assistant tab's tint, AI-sourced findings. Never appears in Writer
  mode.

### Tertiary
- **Analysis Teal** (#2a8a9a): deterministic local analysis (spaCy checks, quote
  normalisation, prose metrics). Present in both modes.

### Neutral
- **Parchment** (#f7f6f3): the page background, behind everything.
- **Paper** (#ffffff): surfaces the author works on: the prose page, sheets, headers.
- **Vellum** (#f0efe9) and **Vellum Deep** (#e8e7e0): recessed areas, hovers, segmented
  controls, chips.
- **Rule** (#e0ded7) and **Rule Light** (#ebe9e2): hairlines between regions and rows.
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

**The AA Rule.** All text reaches 4.5:1 on every ground it sits on: the page, cards, the
vellum of the header, strip and tab bar, hover grounds, and a 12% tint of its own colour
(badges and pills). Slots, control edges and the focus ring reach 3:1. Quiet comes from
colour, never from `opacity` on text.

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

## 4. Elevation

Flat by default. Regions are separated by tone (parchment behind, paper in front, vellum
recessed) and by 1px rules. Shadows appear only on things that float above the desk:
popovers, menus, the palette, dialogs, the floating panel, peek cards.

### Shadow Vocabulary
- **Hairline lift** (`0 1px 2px rgba(0,0,0,0.05)`): pressed chips, small toggles.
- **Resting float** (`0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)`): popovers,
  hover cards, menus.
- **High float** (`0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)`): dialogs,
  the command palette, the floating side panel.

### Named Rules
**The Desk Rule.** Nothing on the desk casts a shadow; only what is lifted off it does.

## 5. Components

### Buttons
- **Shape:** gently rounded (6px); 32px tall in headers, 28px in rows.
- **Primary:** forest fill, paper text. One per view at most.
- **Assistant:** violet fill, `--color-ai-fg` text, Compass or Feather icon plus a text
  label. Studio only.
- **Ghost / Subtle:** transparent with a rule border (ghost) or none (subtle); vellum on
  hover.
- **Focus:** 2px `--color-focus` outline, 2px offset, on every control (fields too).
- **Target:** at least 24px; a small dot gets a 24px hit area round it. An icon-only
  button has an `aria-label` (`iconButtonNames.test.ts`).

### Chips
- **Style:** vellum pill, ink-muted text, count in a lighter weight.
- **State:** pressed chips invert (ink background, parchment text) like the view switch.

### Cards / Containers
- **Sheet cards** (Lorebook side column, Overview): paper, 10px radius, rule border, label
  title, 12px by 14px padding. Never nested.
- **Lists and feeds** (Findings, Proposals, Chronicle): rows divided by rule-light
  hairlines, no card per row.

### Inputs / Fields
- **Style:** paper fill, `--color-control-border` edge, 6px radius; fields on a sheet
  read as text until focused.
- **Focus:** border shifts to forest, plus the focus ring.

### Navigation
- **Story strip** (left): the transit line. Chapters are stations with progress rings,
  scenes are stops shaped by status, and the colour-by key shows only while you hover.
  Widths: line, chapter rows, full tree.
- **Side panel** (right): tabs for This scene, open entities and tools, then a divider and
  the icon-only Assistant tab.
- **Page header:** paper band with a serif title, a pill view switch, a summary line, and a
  ⋯ menu for secondary and Assistant actions.

### The Transit Strip (signature)
The story as a line: stations for chapters, stops for scenes, the current position as a
filled marker and a readout ("Ch 2 · of 7 · 5%"). Colour by who is on the page, threads,
status, beat or findings.

## 6. Do's and Don'ts

### Do:
- **Do** separate regions with tone and a 1px rule before reaching for a card.
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
- **Don't** nest cards, or add shadows to things that sit on the desk.
- **Don't** use em dashes in UI copy.
