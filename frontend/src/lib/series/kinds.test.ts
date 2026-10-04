import { describe, expect, it } from "vitest";
import { KINDS } from "../lorebook/kinds";
import {
  CANON_KINDS,
  PROMISE_KINDS,
  SERIES_KIND_ORDER,
  fieldLabel,
  kindLabel,
  loreKind,
  seriesKindsOf,
  sheetPath,
} from "./kinds";

describe("series kinds", () => {
  it("name the Lorebook kinds the server says they are", () => {
    // backend/app/services/series/kinds.py FRONTEND_KIND: the kinds named differently.
    expect(loreKind("world_system")).toBe("system");
    expect(loreKind("historical_event")).toBe("event");
    expect(loreKind("plot_thread")).toBe("thread");
    for (const kind of SERIES_KIND_ORDER) expect(KINDS[loreKind(kind)]).toBeDefined();
  });

  it("each lives in a real section, threads and twists under Promises", () => {
    for (const kind of SERIES_KIND_ORDER) expect(() => sheetPath("s", kind, "x")).not.toThrow();
    expect(sheetPath("s", "location", "p1")).toBe("/stories/s/lorebook/places/p1");
    expect(sheetPath("s", "plot_thread", "t1")).toBe("/stories/s/promises/threads/t1");
    expect(seriesKindsOf("history")).toEqual(["era", "historical_event"]);
    expect(seriesKindsOf("twists", "promises")).toEqual(["twist"]);
  });

  it("keeps the promises out of the Canon, last as the server carries them", () => {
    expect(PROMISE_KINDS).toEqual(["plot_thread", "twist"]);
    expect(CANON_KINDS).not.toContain("plot_thread");
    expect(SERIES_KIND_ORDER.slice(-2)).toEqual(PROMISE_KINDS);
    expect(kindLabel("twist", true)).toBe("Twists");
  });

  it("labels fields in the sheets' own words", () => {
    expect(fieldLabel("character", "mission_statement")).toBe("Wants");
    expect(fieldLabel("historical_event", "legacy_effects")).toBe("Legacy");
    expect(fieldLabel("character", "made_up_field")).toBe("made up field");
    expect(fieldLabel("plot_thread", "mice_type")).toBe("Kind of promise");
  });
});
