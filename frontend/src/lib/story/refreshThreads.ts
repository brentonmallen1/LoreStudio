import { api } from "../../api/client";
import { sceneCastApi } from "../../api/sceneCast";
import { useStoryStore } from "../../stores/storyStore";
import type { PlotThread } from "../../types";

/**
 * After a thread or one of its scenes changes anywhere (the editor's chips, the Plan page), the
 * story's own copy follows: the strip, the panel's "on this page", the Lorebook list, Numbers
 * and the palette read it, and stayed stale until the scene changed (doc 18).
 */
export async function refreshThreads(storyId: string): Promise<PlotThread[]> {
  const store = useStoryStore.getState();
  const [threads, cast] = await Promise.all([
    api.listThreads(storyId),
    sceneCastApi.get(storyId).catch(() => null),
  ]);
  if (useStoryStore.getState().activeStory?.id === storyId) {
    store.setThreads(threads);
    if (cast) store.setSceneCast(cast);
  }
  return threads;
}
