import { describe, expect, it } from "vitest";
import { ABOUT } from "./about";

describe("the Numbers page's ⓘ text", () => {
  it("says what, why and how to read for every section", () => {
    for (const about of Object.values(ABOUT)) {
      expect(about.measures.length).toBeGreaterThan(0);
      expect(about.why.length).toBeGreaterThan(0);
      expect(about.reading.length).toBeGreaterThan(0);
    }
  });

  // Description, not advice: the page informs, Findings is where something is raised.
  // ("A try that fails" is a thread role, a noun; "try to…" or "try cutting…" is advice.)
  it("never tells the author what to do", () => {
    const advice = /\b(should|ought|consider|try (to|\w+ing)|aim|avoid|too (many|few|long|short|much))\b/i;
    for (const [section, about] of Object.entries(ABOUT)) {
      for (const line of [...about.measures, ...about.why, ...about.reading]) {
        expect(line, section).not.toMatch(advice);
      }
    }
  });
});
