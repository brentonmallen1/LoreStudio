import { describe, expect, it } from "vitest";
import { KINDS } from "../lorebook/kinds";
import { LORE_KIND, LORE_SECTION, SERIES_KIND_ORDER, fieldLabel, seriesKindsOf, sheetPath } from "./kinds";

describe("series kinds", () => {
  it("name the Lorebook kinds the server says they are", () => {
    // backend/app/services/series/kinds.py FRONTEND_KIND: the two kinds named differently.
    expect(LORE_KIND.world_system).toBe("system");
    expect(LORE_KIND.historical_event).toBe("event");
    for (const kind of SERIES_KIND_ORDER) expect(KINDS[LORE_KIND[kind]]).toBeDefined();
  });

  it("each lives in a real Lorebook section", () => {
    for (const kind of SERIES_KIND_ORDER) expect(() => sheetPath("s", kind, "x")).not.toThrow();
    expect(sheetPath("s", "location", "p1")).toBe("/stories/s/lorebook/places/p1");
    expect(seriesKindsOf("history")).toEqual(["era", "historical_event"]);
    expect(Object.keys(LORE_SECTION).sort()).toEqual([...SERIES_KIND_ORDER].sort());
  });

  it("labels fields in the sheets' own words", () => {
    expect(fieldLabel("character", "mission_statement")).toBe("Wants");
    expect(fieldLabel("historical_event", "legacy_effects")).toBe("Legacy");
    expect(fieldLabel("character", "made_up_field")).toBe("made up field");
  });
});
