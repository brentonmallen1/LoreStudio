import { describe, expect, it } from "vitest";
import { anchor, labelRows, strips, timeX, valueY } from "./trend";

describe("Over time's geometry", () => {
  it("places moments by time, a lone one at the end", () => {
    expect(timeX(0, 0, 10)).toBe(0);
    expect(timeX(5, 0, 10)).toBe(50);
    expect(timeX(10, 0, 10)).toBe(100);
    expect(timeX(3, 3, 3)).toBe(100);
  });

  it("places values in their own range, high at the top, flat mid-row", () => {
    expect(valueY(10, 0, 10)).toBe(14);
    expect(valueY(0, 0, 10)).toBe(86);
    expect(valueY(4, 4, 4)).toBe(50);
  });

  it("gives each reading the strip halfway to its neighbours", () => {
    expect(strips([0, 40, 60], 90)).toEqual([
      { from: 0, to: 20 },
      { from: 20, to: 50 },
      { from: 50, to: 90 },
    ]);
  });

  it("stacks names that would overlap and keeps the rest on one row", () => {
    const at = (...xs: number[]) => xs.map((x) => ({ x, w: 80 }));
    expect(labelRows(at(0, 5, 50, 55, 80), 1000)).toEqual([0, 1, 0, 1, 0]);
    // The same names on a narrow plot need more rows.
    expect(labelRows(at(0, 50, 80), 1000)).toEqual([0, 0, 0]);
    expect(labelRows(at(0, 50, 80), 240)).toEqual([0, 1, 0]);
  });

  it("anchors a name at the edges so it stays on the plot", () => {
    expect(anchor(2)).toBe("start");
    expect(anchor(50)).toBe("middle");
    expect(anchor(97)).toBe("end");
  });
});
