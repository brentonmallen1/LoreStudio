import type { Era, HistoricalEvent, Location } from "../../types";
import { slotVar } from "../colorSlots";
import { typeLabel } from "./kinds";

/** A row of a Lorebook list (doc 12 P2). Kept here, not in the component, so it is testable. */
export interface ListItem {
  id: string;
  name: string;
  sub?: string;
  /** A CSS colour, or null for an outlined dot; undefined for no dot. */
  dot?: string | null;
  /** Something about it wants a look (a place found in the prose, a finding). */
  flag?: string;
  depth?: number;
  hasChildren?: boolean;
  /** Not one of the entries: a heading inside the list (an era above its events). */
  heading?: boolean;
}

/** Places as a tree: each under its parent, siblings in their saved order. */
export function placeRows(locations: Location[]): ListItem[] {
  const byParent = new Map<string | null, Location[]>();
  for (const l of locations) {
    const key = l.parent_id && locations.some((p) => p.id === l.parent_id) ? l.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), l]);
  }
  const rows: ListItem[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const l of [...(byParent.get(parent) ?? [])].sort((a, b) => a.position - b.position)) {
      rows.push({
        id: l.id,
        name: l.name,
        sub: l.is_stub ? "Found in your prose" : typeLabel(l.location_type || "") || undefined,
        dot: l.is_stub ? null : slotVar(l.color_slot),
        flag: l.is_stub ? "Found in your prose, not reviewed yet" : undefined,
        depth,
        hasChildren: byParent.has(l.id),
      });
      walk(l.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

/** An era or an event: one list, the events under the era they belong to. */
export type HistoryEntry = (Era & { kind: "era" }) | (HistoricalEvent & { kind: "event" });

/** Eras in order, each followed by its events; events in no era at the end. */
export function historyRows(all: HistoryEntry[]): ListItem[] {
  const eras = all
    .filter((e): e is Era & { kind: "era" } => e.kind === "era")
    .sort((a, b) => a.position - b.position);
  const events = all
    .filter((e): e is HistoricalEvent & { kind: "event" } => e.kind === "event")
    .sort((a, b) => a.position - b.position);
  const rows: ListItem[] = [];
  for (const era of eras) {
    const mine = events.filter((ev) => ev.era_id === era.id);
    const span = [era.start_date, era.end_date].filter(Boolean).join(" – ");
    rows.push({ id: era.id, name: era.name, sub: span || "Era", hasChildren: mine.length > 0 });
    for (const ev of mine)
      rows.push({ id: ev.id, name: ev.name, sub: ev.in_world_date || undefined, depth: 1 });
  }
  const loose = events.filter((ev) => !ev.era_id || !eras.some((e) => e.id === ev.era_id));
  if (loose.length) {
    rows.push({ id: "__loose", name: "Not in an era", heading: true });
    for (const ev of loose) rows.push({ id: ev.id, name: ev.name, sub: ev.in_world_date || undefined });
  }
  return rows;
}
