import { create } from "zustand";
import { seriesApi, type Series, type SeriesElement } from "../api/series";

/**
 * The series the open book belongs to (series doc), or none: the header's trail, the
 * Lorebook's "From the series" rows, the sheets' provenance line and the Series section all
 * read this one copy. Loaded with the story; reloaded after anything that changes it.
 */
interface SeriesStore {
  storyId: string | null;
  series: Series | null;
  /** This book's place in the series, from 0. */
  position: number | null;
  load: (storyId: string) => Promise<void>;
  refetch: () => Promise<void>;
  /** Put a series a call just returned in place, when it is this book's. */
  accept: (series: Series) => void;
}

export const useSeriesStore = create<SeriesStore>((set, get) => ({
  storyId: null,
  series: null,
  position: null,

  load: async (storyId) => {
    if (get().storyId !== storyId) set({ storyId, series: null, position: null });
    try {
      const out = await seriesApi.forStory(storyId);
      if (get().storyId === storyId) set({ series: out.series, position: out.position });
    } catch {
      // A failed read leaves what is on screen.
    }
  },

  refetch: async () => {
    const { storyId, load } = get();
    if (storyId) await load(storyId);
  },

  accept: (series) => {
    const { storyId } = get();
    const position = series.books.find((b) => b.story_id === storyId)?.position;
    if (position === undefined) set({ series: null, position: null });
    else set({ series, position });
  },
}));

/** The element this book's row is, if it is one. */
export function elementForRow(series: Series | null, storyId: string, refId: string): SeriesElement | null {
  return (
    series?.elements.find((e) => e.members.some((m) => m.story_id === storyId && m.ref_id === refId)) ?? null
  );
}

/** "Book 2", for the book at position 1. */
export function bookLabel(position: number): string {
  return `Book ${position + 1}`;
}

/** "Books 1, 2 and 4". */
export function bookList(positions: number[]): string {
  const names = positions.map((p) => String(p + 1));
  if (names.length === 1) return `Book ${names[0]}`;
  return `Books ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
