import type { SeriesKind } from "../../api/series";
import { KINDS, type LoreKind } from "../lorebook/kinds";
import { sectionPath } from "../routes";

/** Where a series kind's sheets live, and its Lorebook kind (for labels and fields). */
interface KindSpec {
  page: "lorebook" | "promises";
  section: string;
  lore: LoreKind;
}

/**
 * Every series kind in the app's words (series doc). The server names some kinds differently
 * (backend services/series/kinds.py FRONTEND_KIND); this is the other half. In the order the
 * Lorebook lists them, the promises last, as the server carries them.
 */
export const SERIES_KIND_SPEC: Record<SeriesKind, KindSpec> = {
  character: { page: "lorebook", section: "characters", lore: "character" },
  location: { page: "lorebook", section: "places", lore: "location" },
  world_system: { page: "lorebook", section: "systems", lore: "system" },
  culture: { page: "lorebook", section: "cultures", lore: "culture" },
  era: { page: "lorebook", section: "history", lore: "era" },
  historical_event: { page: "lorebook", section: "history", lore: "event" },
  calendar: { page: "lorebook", section: "calendars", lore: "calendar" },
  plot_thread: { page: "promises", section: "threads", lore: "thread" },
  twist: { page: "promises", section: "twists", lore: "twist" },
};

/** The order kinds are listed in. */
export const SERIES_KIND_ORDER = Object.keys(SERIES_KIND_SPEC) as SeriesKind[];

/** The Canon's kinds: the Lorebook's. Threads and twists have the series' Promises. */
export const CANON_KINDS = SERIES_KIND_ORDER.filter((k) => SERIES_KIND_SPEC[k].page === "lorebook");

export const PROMISE_KINDS = SERIES_KIND_ORDER.filter((k) => SERIES_KIND_SPEC[k].page === "promises");

export function loreKind(kind: SeriesKind): LoreKind {
  return SERIES_KIND_SPEC[kind].lore;
}

/** The kinds a section lists, the other way round (History lists two). */
export function seriesKindsOf(section: string, page: KindSpec["page"] = "lorebook"): SeriesKind[] {
  return SERIES_KIND_ORDER.filter(
    (k) => SERIES_KIND_SPEC[k].page === page && SERIES_KIND_SPEC[k].section === section,
  );
}

export function kindLabel(kind: SeriesKind, plural = false): string {
  const spec = KINDS[loreKind(kind)];
  return plural ? spec.plural : spec.label;
}

/** The element's sheet in one book. */
export function sheetPath(storyId: string, kind: SeriesKind, refId: string): string {
  const { page, section } = SERIES_KIND_SPEC[kind];
  return sectionPath(storyId, page, section, refId);
}

/** Fields a sheet shows outside its field list (a thread's name, a twist's truth), in words. */
const OTHER_LABELS: Record<string, string> = {
  name: "Name",
  mice_type: "Kind of promise",
  twist_type: "Kind of twist",
  the_truth: "The truth",
  the_misdirection: "What the reader is led to believe",
};

/** A field's label, from the Lorebook's own table. */
export function fieldLabel(kind: SeriesKind, key: string): string {
  const spec = [...KINDS[loreKind(kind)].fields, ...(KINDS[loreKind(kind)].extra ?? [])].find(
    (f) => f.key === key,
  );
  return (spec && (spec.name ?? spec.label)) ?? OTHER_LABELS[key] ?? key.replace(/_/g, " ");
}
