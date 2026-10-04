import { api } from "../../api/client";
import type { SeriesKind } from "../../api/series";
import { useStoryStore } from "../../stores/storyStore";
import { refreshThreads } from "../story/refreshThreads";

/** Entity types whose undo can change what a book shares with its series. */
export const SERIES_UNDO_TYPES = [
  "series_element_member",
  "character",
  "location",
  "world_system",
  "culture",
  "era",
  "historical_event",
  "calendar",
  "plot_thread",
  "twist",
] as const;

/**
 * After an element is brought into the open book: the lists the workspace keeps in its
 * store (cast, places, threads) read again. The other sections load their own lists on view.
 */
export async function refreshBookLists(storyId: string, kind: SeriesKind): Promise<void> {
  const store = useStoryStore.getState();
  if (store.activeStory?.id !== storyId) return;
  if (kind === "character") store.setCharacters(await api.listCharacters(storyId));
  if (kind === "location") store.setLocations(await api.listLocationsFlat(storyId));
  if (kind === "plot_thread") await refreshThreads(storyId);
}
