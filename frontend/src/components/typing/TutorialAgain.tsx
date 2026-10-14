import { useState } from "react";
import { api } from "../../api/client";
import { systemApi } from "../../api/system";
import { navigateTo } from "../../lib/navigation";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import styles from "./TutorialAgain.module.css";

const STORIES = [
  { kind: "prose", title: "Learn LoreStudio" },
  { kind: "screenplay", title: "Learn Screenplays" },
] as const;

/**
 * Guides › Getting started: a fresh copy of a tutorial story, opened at its first lesson
 * (doc 26, P6). The copy you have stays, with whatever you wrote in it.
 */
export default function TutorialAgain() {
  const [busy, setBusy] = useState<string | null>(null);

  async function again(kind: "prose" | "screenplay") {
    setBusy(kind);
    try {
      const { story_id, title } = await systemApi.restartTutorial(kind);
      useStoryStore.getState().setStories(await api.listStories());
      toast.success(`${title} is in your library.`);
      navigateTo(`/stories/${story_id}/write`);
    } catch {
      toast.error("The tutorial could not be made. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.again}>
      {STORIES.map((s) => (
        <button
          key={s.kind}
          type="button"
          className={styles.button}
          disabled={!!busy}
          onClick={() => again(s.kind)}
        >
          {busy === s.kind ? "Making a copy…" : `Start ${s.title}`}
        </button>
      ))}
    </div>
  );
}
