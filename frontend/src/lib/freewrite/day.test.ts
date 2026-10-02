import { describe, expect, it } from "vitest";
import { dayLabel, lastDay, trimEmptyDay } from "./day";

describe("Freewrite days", () => {
  it("names a day the way a journal would", () => {
    expect(dayLabel(new Date(2026, 9, 2))).toBe("Friday 2 October");
  });
  it("finds the last heading", () => {
    expect(lastDay("<h3>Tuesday 1 September</h3><p>a</p><h3>Thursday 3 September</h3><p>b</p>")).toBe(
      "Thursday 3 September",
    );
    expect(lastDay("<p>no days</p>")).toBeNull();
  });
  it("drops a day heading with nothing under it, and only that", () => {
    expect(trimEmptyDay("<p>a</p><h3>Friday 2 October</h3><p></p>")).toBe("<p>a</p>");
    expect(trimEmptyDay("<h3>Friday 2 October</h3><p>kept</p>")).toBe("<h3>Friday 2 October</h3><p>kept</p>");
  });
});
