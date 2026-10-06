import { describe, expect, it } from "vitest";
import type { ReadingSummary } from "../../types/numbers";
import { apart, defaultFrom, quickChoices, readingName, versions } from "./readings";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-10-06T12:00:00Z");
const r = (id: string, daysAgo: number, trigger: ReadingSummary["trigger"], label: string | null = null) =>
  ({
    id,
    taken_at: new Date(now - daysAgo * DAY).toISOString().replace("Z", ""),
    trigger,
    label,
    snapshot_id: null,
    words: 0,
    scenes: 0,
    balance: null,
    passive_pct: null,
    open_findings: null,
  }) as ReadingSummary;

const readings = [
  r("old", 40, "backfill", "Draft 1"),
  r("w", 8, "session"),
  r("v", 3, "snapshot", "Before the storm"),
  r("s1", 1, "session"),
  r("s2", 0.1, "session"),
];

describe("readings", () => {
  it("offers this session, the last, a week and a month ago", () => {
    const q = Object.fromEntries(quickChoices(readings, now).map((c) => [c.id, c.reading?.id ?? null]));
    expect(q).toEqual({ session: "s2", last: "s1", week: "w", month: "old" });
    expect(quickChoices([r("x", 1, "manual")], now).find((c) => c.id === "month")!.reading).toBeNull();
  });

  it("starts from the latest version, or else the latest reading", () => {
    expect(defaultFrom(readings)!.id).toBe("v");
    expect(defaultFrom([r("a", 2, "session"), r("b", 1, "daily")])!.id).toBe("b");
    expect(defaultFrom([])).toBeNull();
  });

  it("names a reading by its version, or by how it was taken", () => {
    expect(versions(readings).map(readingName)).toEqual(["Before the storm", "Draft 1"]);
    expect(readingName(r("x", 0, "session"))).toBe("Start of a session");
  });

  it("says how far apart two moments are", () => {
    expect(apart(0, 5 * DAY)).toBe("5 days");
    expect(apart(0, 3 * 60 * 60 * 1000)).toBe("3 hours");
    expect(apart(0, 60 * 1000)).toBe("1 minute");
  });
});
