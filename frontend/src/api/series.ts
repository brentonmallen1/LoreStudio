import { request } from "./request";
import type { LoreKind } from "../lib/lorebook/kinds";
import type { Story } from "../types";

/** A book's place in its series (from 0). */
export interface SeriesBook {
  story_id: string;
  title: string;
  position: number;
  updated_at: string | null;
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

export interface SeriesElement {
  id: string;
  kind: SeriesKind;
  lore_kind: LoreKind;
  name: string;
  members: SeriesMember[];
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
