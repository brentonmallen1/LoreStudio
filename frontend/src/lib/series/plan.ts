/**
 * The series' plan as a method (series v2): the same rail as a book's Plan, its steps over
 * the series' own fields and its books. Built from the series, as a beat sheet's method is
 * built from its beats: the axes step only asks for each book's place once there are axes.
 *
 * Nothing here is owed. The premise, the books and their parts are the steps a series is
 * planned by; the arc and the axes are there for the author who wants them.
 */
import type { PlanStep } from "../planning/methods";
import type { Series, SeriesAxis, SeriesShape } from "../../api/series";

export type SeriesPlanTarget =
  | { kind: "seriesField"; field: "premise" | "intent" }
  | { kind: "books" }
  | { kind: "roles" }
  | { kind: "arc" }
  | { kind: "axes" }
  | { kind: "slots" };

export type SeriesStep = PlanStep<SeriesPlanTarget>;

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

const PREMISE: SeriesStep = {
  id: "premise",
  label: "Premise",
  why: "What the books are about together: the thread that runs through every book, before any one of them.",
  how: "A sentence or two: the place, the people or the question the series keeps coming back to.",
  example: "A lighthouse on Harrow Island, and what keeping it costs the people who do.",
  target: { kind: "seriesField", field: "premise" },
};

const INTENT: SeriesStep = {
  id: "intent",
  label: "Intent",
  why: "Why it takes more than one book: what the series does that no single book of it could.",
  how: "Where it is going across the books, and what changes between the first and the last.",
  example:
    "Each book asks the keeper the same question from further off: is staying a promise, a habit or a choice?",
  target: { kind: "seriesField", field: "intent" },
};

const BOOKS: SeriesStep = {
  id: "books",
  label: "The books",
  why: "A book planned is a book you can open: it has its own Plan, Lorebook and outline from the start.",
  how: "Add the books you can see, in reading order. A working title is enough; nothing is written until you write it.",
  example: "The Last Lighthouse, then The Keeper's Daughter, then a third still without a title.",
  target: { kind: "books" },
};

const ROLES: SeriesStep = {
  id: "roles",
  label: "Each book's part",
  why: "A sequel that does not know its part retells the first book.",
  how: "For each book, a line: what it does in the series that the others do not.",
  example: "The Keeper's Daughter: the truth is out, and staying is now a choice she has to make again.",
  target: { kind: "roles" },
};

const ARC: SeriesStep = {
  id: "arc",
  label: "Series arc",
  why: "The series has a shape of its own, larger than any book's: where it turns, and where it lands.",
  how: "Name the series' turning points in order, then say which book carries each. A beat can span books.",
  example: "The secret surfaces (Book 1) · Staying becomes a choice (Book 2) · The light goes out (Book 3).",
  target: { kind: "arc" },
  optional: true,
};

const AXES: SeriesStep = {
  id: "axes",
  label: "Viewpoint, era, place",
  why: "What changes from book to book, if anything does. Some series turn on one thing: a different viewpoint each book, a different time, a different place.",
  how: "Add what changes: a viewpoint character, an era, a place, or something of your own. Each becomes a row on the board.",
  example: "Viewpoint: whose eyes each book is seen through. Era: the decade it is set in.",
  target: { kind: "axes" },
  optional: true,
};

const SLOTS: SeriesStep = {
  id: "slots",
  label: "Each book on each row",
  why: "Linked to the Lorebook, a book's viewpoint or era can be checked against its scenes.",
  how: "For each book, choose who or what it is on each axis, or write the idea down until it is someone.",
  example:
    "Book 2's viewpoint is Eleanor; Book 3's is Margaret, written as an idea before she is carried in.",
  target: { kind: "slots" },
};

/** "viewpoint and era": the rows a series has, as words in a sentence. */
export function axesInWords(axes: Pick<SeriesAxis, "label">[]): string {
  const words = axes.map((a) => a.label.toLowerCase());
  return words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The steps for this series, as it stands: the last is named by the rows it fills. */
export function seriesSteps(series: Pick<Series, "axes">): SeriesStep[] {
  const axes = series.axes ?? [];
  const slots = axes.length ? [{ ...SLOTS, label: `Each book's ${axesInWords(axes)}` }] : [];
  return [PREMISE, INTENT, BOOKS, ROLES, ARC, AXES, ...slots];
}

/** Nothing planned yet: no books, no arc, nothing that changes. The Plan walks it through. */
export function planIsEmpty(series: Pick<Series, "books" | "arc" | "axes">): boolean {
  return series.books.length === 0 && !series.arc?.length && !series.axes?.length;
}

/** How far along a step is. A step with nothing to count yet reads 0 of 1. */
export function seriesStepProgress(step: SeriesStep, series: Series): { done: number; total: number } {
  const t = step.target;
  const books = series.books;
  switch (t.kind) {
    case "seriesField":
      return { done: filled(series[t.field]) ? 1 : 0, total: 1 };
    case "books":
      return { done: books.length > 0 ? 1 : 0, total: 1 };
    case "roles":
      if (books.length === 0) return { done: 0, total: 1 };
      return { done: books.filter((b) => filled(b.role)).length, total: books.length };
    case "arc": {
      const arc = series.arc ?? [];
      if (arc.length === 0) return { done: 0, total: 1 };
      const placed = new Set(books.flatMap((b) => b.arc_beats ?? []));
      return { done: arc.filter((b) => placed.has(b.id)).length, total: arc.length };
    }
    case "axes":
      return { done: series.axes?.length ? 1 : 0, total: 1 };
    case "slots": {
      const axes = series.axes ?? [];
      const total = axes.length * books.length;
      if (total === 0) return { done: 0, total: 1 };
      const done = books.reduce(
        (n, b) => n + axes.filter((a) => b.slots?.[a.id]?.element_id || filled(b.slots?.[a.id]?.text)).length,
        0,
      );
      return { done, total };
    }
  }
}

/** The beats of the arc a book carries, in arc order. */
export function beatsOf(series: Series, storyId: string) {
  const ids = new Set(series.books.find((b) => b.story_id === storyId)?.arc_beats ?? []);
  return (series.arc ?? []).filter((b) => ids.has(b.id));
}

/** Ready ways in: the shapes a series most often changes by. */
export const AXIS_PRESETS: { label: string; axis: Omit<SeriesAxis, "id"> }[] = [
  { label: "A viewpoint character", axis: { kind: "character", label: "Viewpoint", pov: true } },
  { label: "An era", axis: { kind: "era", label: "Era" } },
  { label: "A place", axis: { kind: "location", label: "Place" } },
  { label: "Something else", axis: { kind: "custom", label: "" } },
];

/** The series kind an axis is filled from; a custom axis is words only. */
export const AXIS_SERIES_KIND = {
  character: "character",
  era: "era",
  location: "location",
  custom: null,
} as const;

/** What a book is on an axis: a series element, an idea, or nothing yet. */
export function slotOf(series: Series, storyId: string, axisId: string) {
  const slot = series.books.find((b) => b.story_id === storyId)?.slots?.[axisId];
  if (!slot) return null;
  const element = slot.element_id ? (series.elements.find((e) => e.id === slot.element_id) ?? null) : null;
  return {
    name: element?.name ?? slot.text,
    element,
    /** Linked, and the book has its own row of it. */
    inBook: !!element?.members.some((m) => m.story_id === storyId),
  };
}

/** What a shape would do to this series, said before it does it. */
export function shapePreview(shape: SeriesShape, series: Pick<Series, "books" | "axes">): string {
  const books = Math.max(0, shape.roles.length - series.books.length);
  const have = new Set((series.axes ?? []).map((a) => `${a.kind}|${a.label.toLowerCase()}`));
  const axes = shape.axes.filter((a) => !have.has(`${a.kind}|${a.label.toLowerCase()}`));
  const parts = [
    books > 0 && `${books} planned ${books === 1 ? "book" : "books"}`,
    `an arc of ${shape.beats.length} beats`,
    axes.length > 0 && `${axes.map((a) => a.label).join(" and ")} from book to book`,
  ].filter(Boolean);
  return `Adds ${parts.join(", ")}, and a part for each book that has none. Changes nothing you've written.`;
}
