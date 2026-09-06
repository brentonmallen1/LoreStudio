import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import AIPanel from "../components/ai/AIPanel";
import { startAISync } from "../lib/ai/aiSync";
import { useAIStore } from "../stores/aiStore";
import { useStoryStore } from "../stores/storyStore";
import styles from "./AIWindowPage.module.css";

/**
 * The AI panel in its own browser window (doc 06 §2.2, tier 2) — the thing that puts the
 * assistant on a second screen.
 *
 * This is a full client, not a mirror: it talks to the same backend, and the story it is
 * working on comes from `?story=`. A BroadcastChannel keeps its session list and the main
 * window's in step, so closing the window loses nothing.
 */
export default function AIWindowPage() {
  const [params] = useSearchParams();
  const storyId = params.get("story");
  const [error, setError] = useState<string | null>(null);
  const { activeStory, setActiveStory, setCharacters } = useStoryStore();

  useEffect(() => {
    const stop = startAISync("ai-window");
    useAIStore.setState({ panelOpen: true, panelCollapsed: false, panelFloating: false });
    return stop;
  }, []);

  useEffect(() => {
    if (!storyId || activeStory?.id === storyId) return;
    let live = true;
    api
      .getStory(storyId)
      .then((story) => {
        if (!live) return;
        setActiveStory(story);
        return api.listCharacters(storyId).then((chars) => live && setCharacters(chars));
      })
      .catch(() => live && setError("That story could not be loaded in this window."));
    return () => {
      live = false;
    };
  }, [storyId, activeStory?.id, setActiveStory, setCharacters]);

  return (
    <div className={styles.window}>
      {error && <p className={styles.error}>{error}</p>}
      <AIPanel />
    </div>
  );
}
