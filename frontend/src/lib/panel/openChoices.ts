/**
 * What + Open… in the side panel offers: everything that opens beside the page, grouped,
 * filtered by what the author types. Entities and pages open as their own tab; the lists and
 * tools show from the rail, without a tab (doc 24 D11).
 */
import type { EntityKind, ToolId } from "../../types/panel";

export type OpenChoice =
  | { type: "entity"; kind: EntityKind; id: string; label: string; meta?: string }
  | { type: "tool"; tool: ToolId; label: string; meta?: string }
  | { type: "page"; routeId: string; label: string; meta?: string };

export interface OpenGroup {
  name: string;
  choices: OpenChoice[];
}

/** Every word typed appears in the name, in any order, case and accents aside. */
export function matches(label: string, query: string): boolean {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const name = fold(label);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

/** The groups with what matches, empty groups dropped; with no query, every choice. */
export function filterGroups(groups: OpenGroup[], query: string): OpenGroup[] {
  return groups
    .map((g) => ({
      ...g,
      choices: query.trim() ? g.choices.filter((c) => matches(c.label, query)) : g.choices,
    }))
    .filter((g) => g.choices.length > 0);
}
