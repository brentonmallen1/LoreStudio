import gettingStarted from "./getting-started.md?raw";
import structure from "./structure.md?raw";
import planning from "./planning.md?raw";
import dialogue from "./dialogue-and-quotes.md?raw";
import screenplays from "./screenplays.md?raw";
import notes from "./notes-and-freewrite.md?raw";
import promises from "./promises.md?raw";
import series from "./writing-a-series.md?raw";
import snapshots from "./snapshots-and-backups.md?raw";
import numbers from "./numbers.md?raw";
import whoAreThey from "./who-are-they.md?raw";
import jobs from "./jobs.md?raw";
import importExport from "./import-and-export.md?raw";
import search from "./search-and-replace.md?raw";
import glossary from "./glossary.md?raw";
import typing from "./typing.md?raw";
import practice from "./practice.md?raw";
import findings from "./findings.md?raw";
import discoveries from "./discoveries.md?raw";
import chronicle from "./chronicle.md?raw";
import lorebook from "./lorebook.md?raw";
import compendium from "./compendium.md?raw";
import connections from "./connections.md?raw";
import assistantSetup from "./setting-up-the-assistant.md?raw";
import type { UIMode } from "../lib/mode";
import { SHORTCUTS, formatCombo, type ShortcutId } from "../lib/keyboard/shortcuts";

export interface Guide {
  id: string;
  title: string;
  body: string;
  modes: UIMode[];
  keywords: string[];
}

const BOTH: UIMode[] = ["writer", "studio"];
const STUDIO: UIMode[] = ["studio"];

/**
 * In-app guides (refactor doc 04 §8). Markdown files next to this index, imported raw and
 * rendered by GuidePage. Every guide gets a palette command; the coverage test checks that.
 */
const GUIDE_LIST: Guide[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: gettingStarted,
    modes: BOTH,
    keywords: [
      "intro",
      "first",
      "modes",
      "writer",
      "studio",
      "tutorial",
      "lessons",
      "samples",
      "examples",
      "demo",
    ],
  },
  {
    id: "structure",
    title: "Structure and templates",
    body: structure,
    modes: BOTH,
    keywords: ["tree", "chapters", "scenes", "template"],
  },
  {
    id: "planning",
    title: "Planning a story",
    body: planning,
    modes: BOTH,
    keywords: [
      "plan",
      "snowflake",
      "outline",
      "logline",
      "synopsis",
      "method",
      "beat board",
      "planned",
      "beat sheet",
      "timeline",
      "mice",
    ],
  },
  {
    id: "promises",
    title: "Threads, twists and what the reader knows",
    body: promises,
    modes: BOTH,
    keywords: [
      "promises",
      "tapestry",
      "plot threads",
      "mice",
      "twists",
      "clues",
      "foreshadowing",
      "dramatic irony",
      "try fail",
      "tropes",
      "subvert",
    ],
  },
  {
    id: "writing-a-series",
    title: "Writing a series",
    body: series,
    modes: BOTH,
    keywords: [
      "series",
      "sequel",
      "trilogy",
      "books",
      "canon",
      "carry over",
      "enduring",
      "evolving",
      "retcon",
      "threads across books",
      "story so far",
      "coming in",
      "shared research",
      "new series",
      "plan a series",
      "planned book",
      "arc",
      "viewpoint",
      "pov rotation",
      "era",
      "timeline",
      "saga",
      "duology",
    ],
  },
  {
    id: "lorebook",
    title: "The Lorebook",
    body: lorebook,
    modes: BOTH,
    keywords: [
      "canon",
      "characters",
      "places",
      "world",
      "systems",
      "cultures",
      "history",
      "calendars",
      "travel",
      "sheet",
      "bible",
    ],
  },
  {
    id: "discoveries",
    title: "Discoveries",
    body: discoveries,
    modes: BOTH,
    keywords: [
      "proposals",
      "new names",
      "stubs",
      "unattributed dialogue",
      "no speaker",
      "imported",
      "yes or no",
      "inbox",
    ],
  },
  {
    id: "connections",
    title: "Connections",
    body: connections,
    modes: BOTH,
    keywords: ["graph", "map", "codex", "network", "links", "relationships map"],
  },
  {
    id: "compendium",
    title: "The Compendium",
    body: compendium,
    modes: BOTH,
    keywords: ["research", "references", "sources", "links", "documents", "images", "diagrams"],
  },
  {
    id: "findings",
    title: "Findings: what needs your eye",
    body: findings,
    modes: BOTH,
    keywords: [
      "checks",
      "story health",
      "issues",
      "dismiss",
      "it's intended",
      "prose habits",
      "passive voice",
    ],
  },
  {
    id: "chronicle",
    title: "The Chronicle",
    body: chronicle,
    modes: BOTH,
    keywords: ["history", "activity", "changes", "undo", "versions", "imports", "log", "what happened"],
  },
  {
    id: "setting-up-the-assistant",
    title: "Setting up the Assistant",
    body: assistantSetup,
    modes: STUDIO,
    keywords: ["ollama", "model", "gemma", "ai", "set up", "install", "connection", "llm", "test connection"],
  },
  {
    id: "typing",
    title: "What you can type",
    body: typing,
    modes: BOTH,
    keywords: ["typing", "shortcuts", "keys", "slash", "commands", "help", "quick", "faster", "tips"],
  },
  {
    id: "practice",
    title: "Try them out",
    body: practice,
    modes: BOTH,
    keywords: ["practice", "try", "typing", "sandbox", "learn", "tutorial", "helpers"],
  },
  {
    id: "dialogue-and-quotes",
    title: "Dialogue and quotes",
    body: dialogue,
    modes: BOTH,
    keywords: ["speaker", "attribution", "curly", "straight", "tag", "who says this", "thought", "highlight"],
  },
  {
    id: "screenplays",
    title: "Screenplays and stage plays",
    body: screenplays,
    modes: BOTH,
    keywords: [
      "script",
      "screenplay",
      "film",
      "slugline",
      "cue",
      "fountain",
      "final draft",
      "pages",
      "stage play",
      "play",
      "theatre",
    ],
  },
  {
    id: "notes-and-freewrite",
    title: "Notes, Freewrite and the scratch pad",
    body: notes,
    modes: BOTH,
    keywords: ["inline note", "margin", "question", "todo", "to-do", "idea", "freewrite", "scratch"],
  },
  {
    id: "snapshots-and-backups",
    title: "Versions, backups and undo",
    body: snapshots,
    modes: BOTH,
    keywords: ["versions", "restore", "undo", "history", "backup", "database", "redo", "draft"],
  },
  {
    id: "numbers",
    title: "The story in numbers",
    body: numbers,
    modes: BOTH,
    keywords: ["numbers", "compare", "history", "over time", "readings", "versions", "trend", "statistics"],
  },
  {
    id: "jobs",
    title: "Jobs and automatic work",
    body: jobs,
    modes: BOTH,
    keywords: [
      "jobs",
      "background",
      "running",
      "queue",
      "stop",
      "cancel",
      "waiting",
      "cool-down",
      "in flight",
    ],
  },
  {
    id: "who-are-they",
    title: "Who are they: writing people",
    body: whoAreThey,
    modes: BOTH,
    keywords: [
      "gender",
      "pronouns",
      "disability",
      "mental health",
      "trauma",
      "wound",
      "identity",
      "goal motivation conflict",
      "bechdel",
      "rename",
    ],
  },
  {
    id: "import-and-export",
    title: "Import and export",
    body: importExport,
    modes: BOTH,
    keywords: ["docx", "epub", "pdf", "markdown", "novelcrafter", "zip", "import report"],
  },
  {
    id: "search-and-replace",
    title: "Search and replace",
    body: search,
    modes: BOTH,
    keywords: ["find", "rename", "mentions", "other names", "also called"],
  },
  {
    id: "glossary",
    title: "Glossary",
    body: glossary,
    modes: BOTH,
    keywords: [
      "lorebook",
      "manuscript",
      "compendium",
      "codex",
      "chronicle",
      "findings",
      "promises",
      "scene sheet",
      "words",
      "terms",
      "definitions",
      "what does it mean",
      "logline",
      "beat",
      "deuteragonist",
      "archetype",
      "point of view",
      "red herring",
      "said-bookism",
    ],
  },
];

/** "{{key:inlineNote}}" in a guide becomes that shortcut as this platform writes it (D11). */
export function withKeys(body: string): string {
  return body.replace(/\{\{key:(\w+)\}\}/g, (whole, id: string) =>
    id in SHORTCUTS ? formatCombo(SHORTCUTS[id as ShortcutId].combo) : whole,
  );
}

export const GUIDES: Guide[] = GUIDE_LIST.map((g) => ({ ...g, body: withKeys(g.body) }));

const STUDIO_BLOCK = /^<!-- studio -->\n([\s\S]*?)^<!-- \/studio -->\n?/gm;

/**
 * A guide as this mode reads it. What is only in Studio (the Assistant, the Codex) sits
 * between `<!-- studio -->` and `<!-- /studio -->`, each on a line of its own: Writer mode
 * shows no AI at all, guides included, so there the block is gone.
 */
export function forMode(body: string, mode: UIMode): string {
  return body.replace(STUDIO_BLOCK, (_whole, inner: string) => (mode === "studio" ? inner : ""));
}

export function guidesFor(mode: UIMode): Guide[] {
  return GUIDES.filter((g) => g.modes.includes(mode));
}
