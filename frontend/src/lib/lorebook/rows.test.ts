import { describe, expect, it } from "vitest";
import type { Location } from "../../types";
import { historyRows, placeRows, type HistoryEntry } from "./rows";

const place = (
  id: string,
  name: string,
  parent_id: string | null,
  position: number,
  extra: Partial<Location> = {},
) =>
  ({
    id,
    name,
    parent_id,
    position,
    color_slot: 1,
    location_type: "structure",
    is_stub: false,
    ...extra,
  }) as Location;

describe("place rows", () => {
  it("nest under their parent in saved order, and mark a place found in the prose", () => {
    const rows = placeRows([
      place("c", "Cottage", "i", 1),
      place("i", "Island", null, 0, { location_type: "natural_feature" }),
      place("l", "Lighthouse", "i", 0),
      place("m", "Mainland", null, 1, { is_stub: true }),
    ]);
    expect(rows.map((r) => [r.name, r.depth])).toEqual([
      ["Island", 0],
      ["Lighthouse", 1],
      ["Cottage", 1],
      ["Mainland", 0],
    ]);
    expect(rows[0]).toMatchObject({ hasChildren: true, sub: "natural feature" });
    expect(rows[3]).toMatchObject({ dot: null, sub: "Found in your prose" });
    expect(rows[3].flag).toBeTruthy();
  });

  it("treats a place whose parent is gone as top level", () => {
    expect(placeRows([place("x", "Orphan", "gone", 0)])[0].depth).toBe(0);
  });
});

describe("history rows", () => {
  const era = (id: string, name: string, position: number) =>
    ({ id, name, position, start_date: "1894", end_date: "present", kind: "era" }) as unknown as HistoryEntry;
  const ev = (id: string, name: string, era_id: string | null, position: number) =>
    ({ id, name, era_id, position, in_world_date: "1962", kind: "event" }) as unknown as HistoryEntry;

  it("puts events under their era and the rest under a heading", () => {
    const rows = historyRows([ev("s", "Storm", "k", 0), era("k", "Keepers", 0), ev("x", "Loose", null, 0)]);
    expect(rows.map((r) => [r.name, r.depth ?? 0, Boolean(r.heading)])).toEqual([
      ["Keepers", 0, false],
      ["Storm", 1, false],
      ["Not in an era", 0, true],
      ["Loose", 0, false],
    ]);
    expect(rows[0].sub).toBe("1894 – present");
  });
});
