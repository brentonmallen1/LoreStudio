import { request } from "./request";
import type { LoreKind } from "../lib/lorebook/kinds";
import type { Story } from "../types";
import type { BookScene, BookStep } from "../types/promises";

/** A book's place in its series (from 0), and its part of the series' plan (v2). */
export interface SeriesBook {
  story_id: string;
  title: string;
  position: number;
  updated_at: string | null;
  /** What this book does in the series, in the author's words. */
  role?: string;
  /** Where it stands on each axis: a series element, or an idea in words. */
  slots?: Record<string, AxisSlot>;
  /** The ids of the series arc's beats it carries. */
  arc_beats?: string[];
}

/** One beat of a series' arc, placed on the books that carry it. */
export interface ArcBeat {
  id: string;
  name: string;
  description: string;
}

export type AxisKind = "character" | "era" | "location" | "custom";

/** A ready-made start for a series' plan: its books' parts, its arc, what changes between books. */
export interface SeriesShape {
  id: string;
  name: string;
  summary: string;
  roles: string[];
  beats: string[];
  axes: Array<Omit<SeriesAxis, "id">>;
}

/** Something that changes from book to book: a viewpoint character, an era, a place. */
export interface SeriesAxis {
  id: string;
  kind: AxisKind;
  label: string;
  /** Whose eyes each book is seen through: scenes' POV is checked against it. */
  pov?: boolean;
}

export interface AxisSlot {
  element_id: string | null;
  text: string;
}

/** What a slot is set to: a row of a book (made a series element), a series element, an
 * idea in words, or nothing. */
export type SlotInput =
  { kind: string; story_id: string; ref_id: string } | { element_id: string } | { text: string } | null;

export interface BookPlanUpdate {
  role?: string;
  arc_beats?: string[];
  slots?: Record<string, SlotInput>;
}

/** An element as it is in one book: which row there is the series element. */
export interface SeriesMember {
  story_id: string;
  ref_id: string;
  position: number;
}

/** Server kinds; the app calls some of them by other names (`lore_kind`). Threads and twists
 * run across books too, their scenes in each book saying what they do there. */
export type SeriesKind =
  | "character"
  | "location"
  | "world_system"
  | "culture"
  | "era"
  | "historical_event"
  | "calendar"
  | "plot_thread"
  | "twist";

/** Research a series shares, kept in step in every book (v1.5): not in the Canon. */
export type SharedKind = "compendium_entry" | "story_asset" | "diagram";

export interface SeriesElement {
  id: string;
  kind: SeriesKind | SharedKind;
  lore_kind: LoreKind | SharedKind;
  name: string;
  members: SeriesMember[];
  /** Shared research: kept in step in every book. */
  synced: boolean;
}

/** An element of the Canon or of Promises: a Lorebook kind, a thread or a twist. */
export type CanonElement = SeriesElement & { kind: SeriesKind; lore_kind: LoreKind };

export function isCanon(e: SeriesElement): e is CanonElement {
  return !e.synced;
}

/** Shared research on the series page: the books that hold it, and whether they agree. */
export interface SharedItem {
  element_id: string;
  kind: SharedKind;
  name: string;
  members: SeriesMember[];
  in_step: boolean;
  /** Books without a copy (deleted or kept apart there). */
  missing: string[];
}

export type FieldClass = "enduring" | "evolving";

export interface Series {
  id: string;
  name: string;
  premise: string;
  intent: string;
  /** Per-kind overrides of which fields stay true across the series. */
  field_classes: Partial<Record<SeriesKind, Record<string, FieldClass>>>;
  books: SeriesBook[];
  elements: SeriesElement[];
  arc?: ArcBeat[];
  axes?: SeriesAxis[];
}

export interface ElementField {
  key: string;
  field_class: FieldClass;
  values: { story_id: string; position: number; value: string }[];
  /** Enduring only: the books do not agree. */
  differs: boolean;
}

export interface ElementDetail {
  element: SeriesElement;
  fields: ElementField[];
}

/** A series finding once for the series, with the books it stands in: books that disagree
 * about what stays true (`series-canon`), or a thread across books. */
export interface SeriesFinding {
  id: string;
  check: string;
  text: string;
  evidence: string;
  suggestion: string;
  /** The element it is about; a thread only one book has has none. */
  element_id: string | null;
  /** `series-canon` only. */
  field: string;
  story_ids: string[];
  /** A thread finding: the thread in the first book it stands in. */
  ref_id: string | null;
}

export interface SeriesSummary {
  id: string;
  name: string;
  books: SeriesBook[];
  /** For placing a series with no books yet among the stories. */
  updated_at?: string | null;
}

export interface StorySeries {
  series: Series | null;
  position: number | null;
}

/** Something a sequel could start with: a row of the book, or a series element it lacks. */
export interface CarryCandidate {
  kind: SeriesKind;
  lore_kind: LoreKind;
  ref_id: string | null;
  element_id: string | null;
  name: string;
  in_series: boolean;
  parent_ref_id: string | null;
  /** Ticked to begin with: what the series shares, and threads and twists still open. */
  preselect: boolean;
}

export type CarryItem = { kind: SeriesKind; ref_id: string } | { element_id: string };

export interface SequelCreated extends Story {
  start_node_id: string | null;
  series_id: string;
}

/** One thread or twist the series shares, with what each book that has it does there. */
export interface SeriesLane {
  element_id: string;
  kind: "thread" | "twist";
  name: string;
  color_slot: number;
  status: "open" | "resolved" | "set_aside" | "planned" | "planted" | "revealed";
  steps: BookStep[];
}

/** A setup in one book that pays off in another, earlier book first. */
export interface SeriesLink {
  id: string;
  link_type: string;
  note: string;
  source: BookScene;
  target: BookScene;
}

export interface SeriesPromises {
  books: { position: number; story_id: string; title: string }[];
  lanes: SeriesLane[];
  setups: SeriesLink[];
}

export interface SoFarItem {
  text: string;
  source: "clue" | "reveal" | "you";
  story_id: string;
  node_id: string | null;
  /** A belief a later scene overturns: "Book 3 · The Return". */
  over: string | null;
}

/** One book as it leaves the reader: a card of The story so far. */
export interface BookSoFar {
  position: number;
  story_id: string;
  title: string;
  summary: string;
  characters: {
    name: string;
    kind: "character";
    ref_id: string;
    changed: Record<string, string>;
    first_here: boolean;
  }[];
  learned: SoFarItem[];
  believes: SoFarItem[];
  only: SoFarItem[];
  open: { kind: "thread" | "twist"; name: string; story_id: string; ref_id: string; said: string }[];
}

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const seriesApi = {
  list: () => request<SeriesSummary[]>("/series"),
  get: (id: string) => request<Series>(`/series/${id}`),
  create: (body: { name: string; premise?: string; intent?: string; story_ids?: string[] }) =>
    request<Series>("/series", json(body)),
  update: (id: string, body: Partial<Pick<Series, "name" | "premise" | "intent">>) =>
    request<Series>(`/series/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<void>(`/series/${id}`, { method: "DELETE" }),
  forStory: (storyId: string) => request<StorySeries>(`/stories/${storyId}/series`),

  reorder: (id: string, storyIds: string[]) =>
    request<Series>(`/series/${id}/stories`, {
      method: "PUT",
      body: JSON.stringify({ story_ids: storyIds }),
    }),
  join: (id: string, storyId: string, position?: number) =>
    request<Series>(`/series/${id}/stories`, json({ story_id: storyId, position })),
  leave: (id: string, storyId: string) =>
    request<void>(`/series/${id}/stories/${storyId}`, { method: "DELETE" }),
  /** A book planned before it is written: a story with no words yet, in its place (v2). */
  addBook: (id: string, body: { title: string; position?: number; role?: string }) =>
    request<{ series: Series; story_id: string }>(`/series/${id}/books`, json(body)),
  /** The arc across the books, in order; a beat with no id is new. */
  setArc: (id: string, arc: Array<Omit<ArcBeat, "id"> & { id?: string }>) =>
    request<Series>(`/series/${id}/arc`, { method: "PUT", body: JSON.stringify({ arc }) }),
  shapes: () => request<SeriesShape[]>("/series-shapes"),
  /** Start the plan from a shape: fills what is empty, adds what is missing. */
  applyShape: (id: string, shapeId: string) =>
    request<Series>(`/series/${id}/shape`, json({ shape_id: shapeId })),
  /** What changes from book to book; an axis with no id is new. */
  setAxes: (id: string, axes: Array<Omit<SeriesAxis, "id"> & { id?: string }>) =>
    request<Series>(`/series/${id}/axes`, { method: "PUT", body: JSON.stringify({ axes }) }),
  /** One book's own part of the plan: undoable in that book. */
  updateBook: (id: string, storyId: string, body: BookPlanUpdate) =>
    request<Series>(`/series/${id}/books/${storyId}`, { method: "PATCH", body: JSON.stringify(body) }),
  /** Bring elements into a book already in the series (a planned book given its cast later). */
  carryInto: (id: string, storyId: string, sourceStoryId: string, carry: CarryItem[]) =>
    request<Series>(`/series/${id}/books/${storyId}/carry`, json({ source_story_id: sourceStoryId, carry })),

  /** Share one book's row with the series. */
  lift: (id: string, kind: SeriesKind, storyId: string, refId: string) =>
    request<Series>(`/series/${id}/elements`, json({ kind, story_id: storyId, ref_id: refId })),
  unlift: (id: string, elementId: string) =>
    request<Series>(`/series/${id}/elements/${elementId}`, { method: "DELETE" }),
  element: (id: string, elementId: string) => request<ElementDetail>(`/series/${id}/elements/${elementId}`),
  /** Bring an element into a book (copied from where it last stood), or link a row it has. */
  addToBook: (id: string, elementId: string, storyId: string, refId?: string) =>
    request<Series>(
      `/series/${id}/elements/${elementId}/members`,
      json({ story_id: storyId, ref_id: refId }),
    ),
  removeFromBook: (id: string, elementId: string, storyId: string) =>
    request<Series>(`/series/${id}/elements/${elementId}/members/${storyId}`, { method: "DELETE" }),

  /** One book's value of something that stays true, made every book's. */
  propagate: (id: string, elementId: string, field: string, sourceStoryId: string) =>
    request<Series>(
      `/series/${id}/elements/${elementId}/propagate`,
      json({ field, source_story_id: sourceStoryId }),
    ),
  setFieldClass: (id: string, kind: SeriesKind, field: string, fieldClass: FieldClass | null) =>
    request<Series>(`/series/${id}/field-classes`, {
      method: "PATCH",
      body: JSON.stringify({ kind, field, field_class: fieldClass }),
    }),
  findings: (id: string) => request<SeriesFinding[]>(`/series/${id}/findings`),

  /** The series' promises: its tapestry by book and its setups across books. */
  promises: (id: string) => request<SeriesPromises>(`/series/${id}/promises`),
  storySoFar: (id: string) => request<BookSoFar[]>(`/series/${id}/story-so-far`),
  /** A setup across books, made from this book's end: undoable in this book. */
  addLink: (
    id: string,
    body: {
      story_id: string;
      node_id: string;
      other_story_id: string;
      other_node_id: string;
      link_type: string;
      note?: string;
    },
  ) => request<SeriesLink>(`/series/${id}/scene-links`, json(body)),
  removeLink: (id: string, linkId: string) =>
    request<void>(`/series/${id}/scene-links/${linkId}`, { method: "DELETE" }),

  /** Share a book's research, image or diagram: a copy in every book, kept in step. */
  share: (id: string, kind: SharedKind, storyId: string, refId: string) =>
    request<Series>(`/series/${id}/share`, json({ kind, story_id: storyId, ref_id: refId })),
  shared: (id: string) => request<SharedItem[]>(`/series/${id}/shared`),
  /** One book's copy of shared research made every book's. */
  syncFrom: (id: string, elementId: string, sourceStoryId: string) =>
    request<Series>(`/series/${id}/elements/${elementId}/sync`, json({ source_story_id: sourceStoryId })),

  carryOver: (storyId: string) => request<CarryCandidate[]>(`/stories/${storyId}/carry-over`),
  sequel: (
    storyId: string,
    body: {
      title: string;
      description?: string;
      structure_template_id?: string;
      scaffold?: boolean;
      carry: CarryItem[];
      series_name?: string;
    },
  ) => request<SequelCreated>(`/stories/${storyId}/sequel`, json(body)),
};
