import { useEffect, useSyncExternalStore } from "react";
import { netWords, subscribeToday, todaySnapshot, trackScene } from "../../lib/writingToday";

/**
 * Today's writing in this story (lib/writingToday.ts): net words and the minutes spent
 * typing. Records the open scene's saved count as it goes, so the record runs while the
 * status corner is closed; null until anything has happened today.
 */
export function useTodayWords(
  storyId: string,
  nodeId: string,
  savedWords: number,
): { words: number; seconds: number } | null {
  useEffect(() => trackScene(storyId, nodeId, savedWords), [storyId, nodeId, savedWords]);
  const snap = useSyncExternalStore(subscribeToday, todaySnapshot);
  if (!snap || snap.storyId !== storyId) return null;
  const words = netWords(snap.today);
  if (words === 0 && snap.today.activeSeconds === 0) return null;
  return { words, seconds: snap.today.activeSeconds };
}
