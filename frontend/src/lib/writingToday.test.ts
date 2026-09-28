import { describe, expect, it } from "vitest";
import {
  IDLE_SECONDS,
  TICK_SECONDS,
  emptyToday,
  formatMinutes,
  netWords,
  withTick,
  withWordCount,
} from "./writingToday";

describe("today's writing", () => {
  it("counts time only while there has been writing recently", () => {
    const now = 1_000_000;
    let t = emptyToday("2026-09-28");
    t = withTick(t, now, now - 30_000);
    expect(t.activeSeconds).toBe(TICK_SECONDS);
    t = withTick(t, now, now - (IDLE_SECONDS + 1) * 1000);
    expect(t.activeSeconds).toBe(TICK_SECONDS);
    t = withTick(t, now, null);
    expect(t.activeSeconds).toBe(TICK_SECONDS);
  });

  it("counts net words per scene from its first count today", () => {
    let t = emptyToday("2026-09-28");
    t = withWordCount(t, "a", 200);
    t = withWordCount(t, "a", 260);
    t = withWordCount(t, "b", 50);
    t = withWordCount(t, "b", 40);
    expect(netWords(t)).toBe(50);
  });

  it("reads minutes the way a person would", () => {
    expect(formatMinutes(59)).toBe("0 min");
    expect(formatMinutes(42 * 60)).toBe("42 min");
    expect(formatMinutes(95 * 60)).toBe("1 h 35 min");
  });
});
