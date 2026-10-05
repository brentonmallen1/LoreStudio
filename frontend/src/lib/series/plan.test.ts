import { describe, expect, it } from "vitest";
import type { Series, SeriesBook } from "../../api/series";
import { firstOpen } from "../planning/methods";
import { beatsOf, seriesStepProgress, seriesSteps, shapePreview, slotOf } from "./plan";

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
  it("asks where each book stands once there is something that changes between them", () => {
    const s = series({
      axes: [{ id: "v", kind: "character", label: "Viewpoint", pov: true }],
      books: [book(1, { slots: { v: { element_id: "el", text: "Eleanor" } } }), book(2)],
      elements: [
        { id: "el", kind: "character", lore_kind: "character", name: "Eleanor", synced: false, members: [] },
      ],
    });
    const steps = seriesSteps(s);
    expect(steps.map((st) => st.id).slice(-2)).toEqual(["axes", "slots"]);
    expect(seriesStepProgress(steps[steps.length - 1], s)).toEqual({ done: 1, total: 2 });
    expect(slotOf(s, "b1", "v")).toEqual({ name: "Eleanor", element: s.elements[0], inBook: false });
    expect(slotOf(s, "b2", "v")).toBeNull();
  });

  it("asks for what the books are about first, and never owes the arc", () => {
    const s = series();
    const steps = seriesSteps(s);
    expect(steps.map((st) => st.id)).toEqual(["premise", "intent", "books", "roles", "arc", "axes"]);
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

describe("a shape's preview", () => {
  it("says what it adds and that nothing written changes", () => {
    const shape = {
      id: "generational",
      name: "Generational saga",
      summary: "",
      roles: ["a", "b", "c"],
      beats: ["x", "y", "z"],
      axes: [
        { kind: "character" as const, label: "Viewpoint", pov: true },
        { kind: "era" as const, label: "Era" },
      ],
    };
    const s = series({ books: [book(1)], axes: [{ id: "e", kind: "era", label: "era" }] });
    expect(shapePreview(shape, s)).toBe(
      "Adds 2 planned books, an arc of 3 beats, Viewpoint from book to book, and a part for each book that has none. Changes nothing you've written.",
    );
  });
});
