import { describe, expect, it } from "vitest";
import type { Series, SeriesBook } from "../../api/series";
import { firstOpen } from "../planning/methods";
import { beatsOf, seriesStepProgress, seriesSteps } from "./plan";

const book = (n: number, extra: Partial<SeriesBook> = {}): SeriesBook => ({
  story_id: `b${n}`,
  title: `Book ${n}`,
  position: n - 1,
  updated_at: null,
  ...extra,
});

const series = (extra: Partial<Series> = {}): Series => ({
  id: "s",
  name: "The Lighthouse Years",
  premise: "",
  intent: "",
  field_classes: {},
  books: [],
  elements: [],
  arc: [],
  axes: [],
  ...extra,
});

describe("the series plan", () => {
  it("asks for what the books are about first, and never owes the arc", () => {
    const s = series();
    const steps = seriesSteps(s);
    expect(steps.map((st) => st.id)).toEqual(["premise", "intent", "books", "roles", "arc"]);
    const progress = (st: (typeof steps)[number]) => seriesStepProgress(st, s);
    expect(firstOpen(steps, progress)?.id).toBe("premise");

    const planned = series({
      premise: "A lighthouse.",
      intent: "Staying, three ways.",
      books: [book(1, { role: "The secret surfaces." }), book(2, { role: "She chooses." })],
    });
    expect(firstOpen(steps, (st) => seriesStepProgress(st, planned))).toBeNull();
  });

  it("counts each book's part, and an arc's beats placed on a book", () => {
    const s = series({
      books: [book(1, { role: "The secret surfaces.", arc_beats: ["a"] }), book(2)],
      arc: [
        { id: "a", name: "Lit", description: "" },
        { id: "b", name: "Out", description: "" },
      ],
    });
    const [, , , roles, arc] = seriesSteps(s);
    expect(seriesStepProgress(roles, s)).toEqual({ done: 1, total: 2 });
    expect(seriesStepProgress(arc, s)).toEqual({ done: 1, total: 2 });
    expect(beatsOf(s, "b1").map((b) => b.name)).toEqual(["Lit"]);
    expect(beatsOf(s, "b2")).toEqual([]);
  });
});
