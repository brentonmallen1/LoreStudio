import type { UIMode } from "../mode";
import { PARTS, SAFE, SERIES, WRITING } from "./app";
import { DEVICES, PEOPLE, PLANNING, PROSE, SCRIPTS } from "./craft";
import type { GlossaryEntry, GlossaryGroup } from "./types";

export type { GlossaryEntry, GlossaryGroup } from "./types";

/**
 * The glossary (doc 30 D1), one source for two readers: `guides/glossary.md` draws each group
 * where it says `<!-- terms:<group> -->`, and `Term` shows one entry in a popover. The guide's
 * headings and its framing words stay in the Markdown; the entries live here, typed, so a
 * `Term` naming an entry that does not exist fails to compile.
 */
export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = [
  { id: "parts", entries: PARTS },
  { id: "writing", entries: WRITING },
  { id: "planning", entries: PLANNING },
  { id: "people", entries: PEOPLE },
  { id: "devices", entries: DEVICES },
  { id: "prose", entries: PROSE },
  { id: "scripts", entries: SCRIPTS },
  { id: "series", entries: SERIES },
  { id: "safe", entries: SAFE },
];

const ALL = [
  ...PARTS,
  ...WRITING,
  ...PLANNING,
  ...PEOPLE,
  ...DEVICES,
  ...PROSE,
  ...SCRIPTS,
  ...SERIES,
  ...SAFE,
];

export type TermId = (typeof ALL)[number]["id"];

const BY_ID = new Map<string, GlossaryEntry>(ALL.map((e) => [e.id, e]));

export function glossaryEntry(id: TermId | string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}

/** Every entry, in the guide's order. */
export function allTerms(): GlossaryEntry[] {
  return [...ALL];
}

/** The entries a mode shows: Writer mode has no AI, so a Studio entry is not there. */
export function entriesFor(group: GlossaryGroup, mode: UIMode): GlossaryEntry[] {
  return group.entries.filter((e) => mode === "studio" || !e.studio);
}

/** Where an entry is read in full. */
export function glossaryHref(id: string): string {
  return `/guides/glossary#${id}`;
}
