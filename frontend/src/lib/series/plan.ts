/**
 * The series' plan as a method (series v2): the same rail as a book's Plan, its steps over
 * the series' own fields and its books. Built from the series, as a beat sheet's method is
 * built from its beats: the axes step only asks for each book's place once there are axes.
 *
 * Nothing here is owed. The premise, the books and their parts are the steps a series is
 * planned by; the arc and the axes are there for the author who wants them.
 */
import type { PlanStep } from "../planning/methods";
import type { Series } from "../../api/series";

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
  label: "What the books are about",
  why: "The thread that runs through every book, before any one of them.",
  how: "A sentence or two: the place, the people or the question the series keeps coming back to.",
  example: "A lighthouse on Harrow Island, and what keeping it costs the people who do.",
  target: { kind: "seriesField", field: "premise" },
};

const INTENT: SeriesStep = {
  id: "intent",
  label: "Why it takes more than one book",
  why: "What the series does that no single book of it could.",
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
  label: "What each book does",
  why: "A sequel that does not know its part retells the first book.",
  how: "For each book, a line: what it does in the series that the others do not.",
  example: "The Keeper's Daughter: the truth is out, and staying is now a choice she has to make again.",
  target: { kind: "roles" },
};

const ARC: SeriesStep = {
  id: "arc",
  label: "The arc across the books",
  why: "The series has a shape of its own, larger than any book's: where it turns, and where it lands.",
  how: "Name the series' turning points in order, then say which book carries each. A beat can span books.",
  example: "The secret surfaces (Book 1) · Staying becomes a choice (Book 2) · The light goes out (Book 3).",
  target: { kind: "arc" },
  optional: true,
};

const AXES: SeriesStep = {
  id: "axes",
  label: "What changes from book to book",
  why: "Some series turn on one thing: a different viewpoint each book, a different time, a different place.",
  how: "Add what changes, if anything does: a viewpoint character, an era, a place, or something of your own.",
  example: "Viewpoint: whose eyes each book is seen through. Era: the decade it is set in.",
  target: { kind: "axes" },
  optional: true,
};

const SLOTS: SeriesStep = {
  id: "slots",
  label: "Each book on each axis",
  why: "Linked to the Lorebook, a book's viewpoint or era can be checked against its scenes.",
  how: "For each book, choose who or what it is on each axis, or write the idea down until it is someone.",
  example:
    "Book 2's viewpoint is Eleanor; Book 3's is Margaret, written as an idea before she is carried in.",
  target: { kind: "slots" },
};

/** The steps for this series, as it stands. */
export function seriesSteps(series: Pick<Series, "axes">): SeriesStep[] {
  return [PREMISE, INTENT, BOOKS, ROLES, ARC, AXES, ...(series.axes?.length ? [SLOTS] : [])];
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
