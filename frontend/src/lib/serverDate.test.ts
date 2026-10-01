import { describe, it, expect } from "vitest";

// West of Greenwich, where the bug lived. In UTC a bare `new Date()` happens to be right.
process.env.TZ = "America/New_York";
import { ago, parseServerDate, serverTime } from "./serverDate";

describe("parseServerDate", () => {
  it("reproduces the bug it exists for", () => {
    const naive = new Date("2026-09-25T21:23:41.781");
    expect(naive.toISOString()).not.toBe("2026-09-25T21:23:41.781Z");
  });

  it("reads an offset-less API timestamp as UTC, not local time", () => {
    expect(parseServerDate("2026-09-25T21:23:41.781").toISOString()).toBe("2026-09-25T21:23:41.781Z");
  });

  it("leaves a timestamp that already carries an offset as it is", () => {
    expect(parseServerDate("2026-09-25T21:23:41Z").toISOString()).toBe("2026-09-25T21:23:41.000Z");
    expect(parseServerDate("2026-09-25T17:23:41-04:00").toISOString()).toBe("2026-09-25T21:23:41.000Z");
    expect(parseServerDate("2026-09-25T21:23:41+00:00").toISOString()).toBe("2026-09-25T21:23:41.000Z");
  });

  it("puts a timestamp written a moment ago a moment in the past, in any timezone", () => {
    const justNow = new Date(Date.now() - 1000).toISOString().replace("Z", "");
    const age = Date.now() - serverTime(justNow);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(60_000);
  });
});

describe("ago", () => {
  const now = Date.UTC(2026, 8, 30, 12, 0);
  it("reads a server time as words", () => {
    expect(ago(null, now)).toBe("never");
    expect(ago("2026-09-30T11:59:40", now)).toBe("just now");
    expect(ago("2026-09-30T11:48:00", now)).toBe("12 min ago");
    expect(ago("2026-09-30T09:00:00", now)).toBe("3 h ago");
    expect(ago("2026-09-29T12:00:00", now)).toBe("yesterday");
    expect(ago("2026-09-26T12:00:00", now)).toBe("4 days ago");
  });
});
