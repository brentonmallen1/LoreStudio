import type { CarryCandidate, CarryItem } from "../../api/series";

/** A candidate's key in the chosen set: its row, or the series element it would come from. */
export function carryKey(c: CarryCandidate): string {
  return c.ref_id ?? `element:${c.element_id}`;
}

export function carryItem(c: CarryCandidate): CarryItem {
  return c.ref_id ? { kind: c.kind, ref_id: c.ref_id } : { element_id: c.element_id as string };
}
