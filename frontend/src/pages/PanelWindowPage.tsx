import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StoryPanel from "../components/panel/StoryPanel";
import { startAISync } from "../lib/ai/aiSync";
import { startPanelSync } from "../lib/panel/panelSync";
import { loadStoryIntoStores } from "../lib/story/loadStory";
import { useStoryStore } from "../stores/storyStore";
import styles from "./PanelWindowPage.module.css";

/**
 * The side panel in its own browser window (refactor doc 11, phase 5): tabs, assistant and
 * all, on a second screen. A full client on the same backend; two channels keep its tabs
 * and its sessions in step with the main window, so closing it loses nothing.
 */
export default function PanelWindowPage() {
  const [params] = useSearchParams();
  const storyId = params.get("story");
  const [error, setError] = useState<string | null>(null);
  const activeStoryId = useStoryStore((s) => s.activeStory?.id);

  useEffect(() => {
    const stopAI = startAISync("ai-window");
    const stopPanel = startPanelSync("window");
    return () => {
      stopAI();
      stopPanel();
    };
  }, []);

  useEffect(() => {
    if (!storyId || activeStoryId === storyId) return;
    let live = true;
    loadStoryIntoStores(storyId).catch(
      () => live && setError("That story could not be loaded in this window."),
    );
    return () => {
      live = false;
    };
  }, [storyId, activeStoryId]);

  return (
    <div className={styles.window}>
      {error && <p className={styles.error}>{error}</p>}
      <StoryPanel fill />
    </div>
  );
}
