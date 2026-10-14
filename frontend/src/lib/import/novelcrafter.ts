import type {
  EntryTarget,
  FacetField,
  NcEntry,
  NcEntryChoice,
  NovelcrafterChoices,
  NovelcrafterPreview,
  SnippetTarget,
} from "../../types/novelcrafter";

/**
 * What comes over from a Novelcrafter export (doc 28): the words for each destination, the
 * choices a row can take, and the groups the wizard shows. Pure, so the wizard's sums and
 * the server's defaults are tested alike.
 */

export const TARGETS: { value: EntryTarget; label: string; group: string }[] = [
  { value: "character", label: "A character", group: "Characters" },
  { value: "location", label: "A place", group: "Places" },
  { value: "thread", label: "A thread", group: "Threads" },
  { value: "trope", label: "A trope in play", group: "Tropes" },
  { value: "theme", label: "A theme", group: "Themes" },
  { value: "world_system", label: "A world system", group: "World systems" },
  { value: "culture", label: "A culture", group: "Cultures" },
  { value: "historical_event", label: "A historical event", group: "Events" },
  { value: "compendium", label: "The Compendium", group: "In the Compendium" },
  { value: "note", label: "A note", group: "Notes" },
  { value: "facet", label: "Into a character", group: "Folded into a character" },
  { value: "merge", label: "Into the entry it looks like", group: "Folded into another entry" },
  { value: "later", label: "Decide later", group: "Decide later" },
  { value: "skip", label: "Leave out", group: "Left out" },
];

export const FACET_LABELS: Record<FacetField, string> = {
  appearance: "appearance",
  speech_patterns: "way of speaking",
  thinking: "inner life",
  background: "background",
  personality: "personality",
  note: "notes",
};

export const SNIPPET_TARGETS: { value: SnippetTarget; label: string }[] = [
  { value: "note", label: "A note" },
  { value: "compendium", label: "The Compendium" },
  { value: "logline", label: "The logline" },
  { value: "later", label: "Decide later" },
  { value: "skip", label: "Leave out" },
];

/** A row's choice: the author's, else the default the server proposed. */
export function choiceOf(entry: NcEntry, choices: NovelcrafterChoices): NcEntryChoice {
  return (
    choices.entries[entry.id] ?? {
      target: entry.target,
      facet_of: entry.facet_of,
      facet_field: entry.facet_field,
    }
  );
}

/** The destinations a row can take: folding only where there is something to fold into. */
export function optionsFor(entry: NcEntry): EntryTarget[] {
  return TARGETS.map((t) => t.value).filter(
    (v) => (v !== "facet" || entry.facet_of) && (v !== "merge" || entry.clash_with),
  );
}

/** The choice for a destination picked in a row's menu. */
export function choose(entry: NcEntry, target: EntryTarget): NcEntryChoice {
  if (target === "facet")
    return { target, facet_of: entry.facet_of, facet_field: entry.facet_field ?? "note" };
  if (target === "merge") return { target, merge_into: entry.clash_with };
  return { target };
}

export interface Group {
  label: string;
  target: EntryTarget;
  entries: NcEntry[];
}

/** The entries by where they go, in the order of `TARGETS`. */
export function groupEntries(preview: NovelcrafterPreview, choices: NovelcrafterChoices): Group[] {
  return TARGETS.map((t) => ({
    label: t.group,
    target: t.value,
    entries: preview.entries.filter((e) => choiceOf(e, choices).target === t.value),
  })).filter((g) => g.entries.length > 0);
}

export interface Tally {
  entries: number;
  home: number;
  later: number;
  left: number;
}

/** The sentence at the top: how many have a home, wait, or stay behind. */
export function tally(preview: NovelcrafterPreview, choices: NovelcrafterChoices): Tally {
  const targets = preview.entries.map((e) => choiceOf(e, choices).target);
  const snippets = preview.snippets.map((s) => choices.snippets[s.id] ?? s.target);
  const later = targets.filter((t) => t === "later").length + snippets.filter((t) => t === "later").length;
  const left = targets.filter((t) => t === "skip").length + snippets.filter((t) => t === "skip").length;
  return {
    entries: preview.entries.length,
    home: targets.length + snippets.length - later - left,
    later,
    left,
  };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const EMPTY_CHOICES: NovelcrafterChoices = {
  entries: {},
  snippets: {},
  chats: true,
  screenplay: false,
};
