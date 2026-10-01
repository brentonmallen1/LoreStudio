import { useEffect, useSyncExternalStore } from "react";
import { formatMinutes, netWords, subscribeToday, todaySnapshot, trackScene } from "../../lib/writingToday";
import styles from "./TodayCounter.module.css";

interface Props {
  storyId: string;
  nodeId: string;
  /** The scene's saved word count: always this scene's, unlike the live editor count. */
  savedWords: number;
}

/** " · +612 today" after the scene's word count, the time in its tooltip: a quiet record of
 * the day's writing (lib/writingToday.ts). */
export default function TodayCounter({ storyId, nodeId, savedWords }: Props) {
  useEffect(() => trackScene(storyId, nodeId, savedWords), [storyId, nodeId, savedWords]);
  const snap = useSyncExternalStore(subscribeToday, todaySnapshot);
  if (!snap || snap.storyId !== storyId) return null;

  const words = netWords(snap.today);
  if (words === 0 && snap.today.activeSeconds === 0) return null;
  return (
    <span
      className={styles.today}
      title={`Today in this story: ${formatMinutes(snap.today.activeSeconds)} writing (it pauses after two idle minutes) and ${words >= 0 ? "+" : "−"}${Math.abs(words).toLocaleString()} words across scenes`}
    >
      {" · "}
      {words >= 0 ? "+" : "−"}
      {Math.abs(words).toLocaleString()} today
    </span>
  );
}
