import { describe, expect, it } from "vitest";
import { assignSides } from "./sides";

const sides = (speakers: (string | null)[]) => assignSides(speakers).map((p) => p.side);
const starts = (speakers: (string | null)[]) => assignSides(speakers).map((p) => p.runStart);

describe("assignSides", () => {
  it("alternates two speakers line for line", () => {
    expect(sides(["Mara", "Eli", "Mara", "Eli"])).toEqual(["left", "right", "left", "right"]);
    expect(starts(["Mara", "Eli", "Mara", "Eli"])).toEqual([true, true, true, true]);
  });

  it("keeps a run by one speaker on one side, named once", () => {
    const speakers = ["Mara", "Mara", "Mara", "Eli", "Eli", "Mara"];
    expect(sides(speakers)).toEqual(["left", "left", "left", "right", "right", "left"]);
    expect(starts(speakers)).toEqual([true, false, false, true, false, true]);
  });

  it("treats a speaker's name the same whatever its case or spacing", () => {
    expect(sides(["Mara", " mara ", "Eli"])).toEqual(["left", "left", "right"]);
  });

  it("flips on every change with three speakers, not by who spoke first", () => {
    // By first appearance Tom would sit left again (third speaker); by turns he answers Eli.
    expect(sides(["Mara", "Eli", "Tom", "Mara", "Tom"])).toEqual(["left", "right", "left", "right", "left"]);
  });

  it("centres a line with no speaker and does not flip the side for it", () => {
    expect(sides(["Mara", null, "Eli", "", "Eli", "Mara"])).toEqual([
      "left",
      "centre",
      "right",
      "centre",
      "right",
      "left",
    ]);
  });

  it("names a speaker again when a centred line broke the run", () => {
    expect(starts(["Mara", null, "Mara", "Mara"])).toEqual([true, true, true, false]);
    expect(sides(["Mara", null, "Mara"])).toEqual(["left", "centre", "left"]);
  });

  it("starts on the left even after leading lines with no speaker", () => {
    expect(sides([null, "Mara", "Eli"])).toEqual(["centre", "left", "right"]);
    expect(assignSides([])).toEqual([]);
  });
});
