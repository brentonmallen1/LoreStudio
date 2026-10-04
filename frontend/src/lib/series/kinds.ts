import type { SeriesKind } from "../../api/series";
import { KINDS, type LoreKind } from "../lorebook/kinds";
import { sectionPath } from "../routes";

/**
 * The series kinds in the Lorebook's words (series doc). The server names two kinds
 * differently (backend services/series/kinds.py FRONTEND_KIND); this is the other half.
 */
export const LORE_KIND: Record<SeriesKind, LoreKind> = {
  character: "character",
  location: "location",
  world_system: "system",
  culture: "culture",
  era: "era",
  historical_event: "event",
  calendar: "calendar",
};

/** The Lorebook section each kind's sheets live in. */
export const LORE_SECTION: Record<SeriesKind, string> = {
  character: "characters",
  location: "places",
  world_system: "systems",
  culture: "cultures",
  era: "history",
  historical_event: "history",
  calendar: "calendars",
};

/** The order kinds are listed in: the Lorebook's. */
export const SERIES_KIND_ORDER: SeriesKind[] = [
  "character",
  "location",
  "world_system",
  "culture",
  "era",
  "historical_event",
  "calendar",
];

/** The kind a Lorebook section lists, the other way round (History lists two). */
export function seriesKindsOf(section: string): SeriesKind[] {
  return SERIES_KIND_ORDER.filter((k) => LORE_SECTION[k] === section);
}

export function kindLabel(kind: SeriesKind, plural = false): string {
  const spec = KINDS[LORE_KIND[kind]];
  return plural ? spec.plural : spec.label;
}

/** The element's sheet in one book. */
export function sheetPath(storyId: string, kind: SeriesKind, refId: string): string {
  return sectionPath(storyId, "lorebook", LORE_SECTION[kind], refId);
}

/** A field's label, from the Lorebook's own table. */
export function fieldLabel(kind: SeriesKind, key: string): string {
  return KINDS[LORE_KIND[kind]].fields.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");
}
