import gettingStarted from "./getting-started.md?raw";
import structure from "./structure.md?raw";
import planning from "./planning.md?raw";
import dialogue from "./dialogue-and-quotes.md?raw";
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
    keywords: ["intro", "first", "modes", "writer", "studio"],
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
    keywords: ["plan", "snowflake", "outline", "logline", "synopsis", "method", "beat board", "planned"],
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
    id: "dialogue-and-quotes",
    title: "Dialogue and quotes",
    body: dialogue,
    modes: BOTH,
    keywords: ["speaker", "attribution", "curly", "straight"],
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
    title: "Snapshots, backups and undo",
    body: snapshots,
    modes: BOTH,
    keywords: ["versions", "restore", "undo", "history"],
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
    title: "Jobs: work that runs while you write",
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
    keywords: ["docx", "epub", "pdf", "markdown"],
  },
  {
    id: "search-and-replace",
    title: "Search and replace",
    body: search,
    modes: BOTH,
    keywords: ["find", "rename"],
  },
  {
    id: "glossary",
    title: "Glossary",
    body: glossary,
    modes: BOTH,
    keywords: ["lorebook", "manuscript", "compendium", "codex", "chronicle"],
  },
];

/** "{{key:inlineNote}}" in a guide becomes that shortcut as this platform writes it (D11). */
export function withKeys(body: string): string {
  return body.replace(/\{\{key:(\w+)\}\}/g, (whole, id: string) =>
    id in SHORTCUTS ? formatCombo(SHORTCUTS[id as ShortcutId].combo) : whole,
  );
}

export const GUIDES: Guide[] = GUIDE_LIST.map((g) => ({ ...g, body: withKeys(g.body) }));

export function guidesFor(mode: UIMode): Guide[] {
  return GUIDES.filter((g) => g.modes.includes(mode));
}
