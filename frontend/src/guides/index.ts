import gettingStarted from "./getting-started.md?raw";
import structure from "./structure.md?raw";
import planning from "./planning.md?raw";
import dialogue from "./dialogue-and-quotes.md?raw";
import notes from "./notes-and-todos.md?raw";
import snapshots from "./snapshots-and-backups.md?raw";
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
    id: "dialogue-and-quotes",
    title: "Dialogue and quotes",
    body: dialogue,
    modes: BOTH,
    keywords: ["speaker", "attribution", "curly", "straight"],
  },
  {
    id: "notes-and-todos",
    title: "Notes, TODOs and the scratch pad",
    body: notes,
    modes: BOTH,
    keywords: ["inline note", "todo", "scratch"],
  },
  {
    id: "snapshots-and-backups",
    title: "Snapshots, backups and undo",
    body: snapshots,
    modes: BOTH,
    keywords: ["versions", "restore", "undo", "history"],
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
