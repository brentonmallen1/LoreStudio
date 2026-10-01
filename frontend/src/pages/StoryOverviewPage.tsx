import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Download } from "lucide-react";
import { api } from "../api/client";
import {
  CastAndPlaces,
  Lately,
  NeedsYourEye,
  Vitals,
  WordsByChapter,
} from "../components/overview/OverviewCards";
import Recap from "../components/overview/Recap";
import StartPaths from "../components/overview/StartPaths";
import PlanNextStep from "../components/plan/PlanNextStep";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { ago } from "../lib/serverDate";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import type { StoryOverview } from "../types";
import styles from "../components/overview/Overview.module.css";

const LENGTH_LABELS: Record<string, string> = {
  flash_fiction: "Flash fiction",
  short_story: "Short story",
  novelette: "Novelette",
  novella: "Novella",
  novel: "Novel",
  epic_saga: "Epic / saga",
  series: "Series",
};

/**
 * The story's home (doc 12 P6): what it is, where you were, its numbers, what needs your
 * eye, where the words are, who and where it is about, and what happened lately. No page
 * header: this page is the story's title page.
 */
export default function StoryOverviewPage({ storyId }: { storyId: string }) {
  const { activeStory: story, structure } = useStoryStore();
  const aiAvailable = useAIAvailable();
  const [ov, setOv] = useState<StoryOverview | null>(null);
  const load = () => api.getStoryOverview(storyId).then(setOv);
  useEffect(() => {
    void load().catch(() => {});
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnUndo(["structure_node", "plot_thread", "story", "character"], load);

  if (!story) return <div className={styles.loading}>Loading…</div>;
  const hasContent = !!ov && (ov.word_count > 0 || ov.scene_count > 0);
  const recent = ov?.recent_scenes[0];
  const chapterOf = (id: string) => {
    const walk = (nodes: typeof structure, parent: string): string | null => {
      for (const n of nodes) {
        if (n.id === id) return parent;
        const found = n.children?.length ? walk(n.children, n.title) : null;
        if (found !== null) return found;
      }
      return null;
    };
    return walk(structure, "") || "";
  };
  const line = story.logline || story.premise || story.narrative_intent;

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{story.title}</h1>
            {line && <p className={styles.logline}>{line}</p>}
            <div className={styles.chips}>
              {[story.genre, story.tone, LENGTH_LABELS[story.intended_length ?? ""] ?? story.intended_length]
                .filter(Boolean)
                .map((t) => (
                  <Link key={t} to={`/stories/${storyId}/lorebook`} className={styles.chip}>
                    {t}
                  </Link>
                ))}
            </div>
          </div>
          {ov && (
            <div className={styles.heroSide}>
              <Link
                to={recent ? `/stories/${storyId}/write/${recent.id}` : `/stories/${storyId}/write`}
                className={styles.continue}
              >
                <span className={styles.continueLabel}>
                  {hasContent ? "Continue writing" : "Start writing"}
                </span>
                {recent && <span className={styles.continueTitle}>{recent.title || "Untitled scene"}</span>}
                {recent && (
                  <span className={styles.continueMeta}>
                    {[chapterOf(recent.id), `last worked on ${ago(recent.updated_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </Link>
              {hasContent && (
                <div className={styles.heroLinks}>
                  <Link to={`/stories/${storyId}/publish`} className={styles.headLink}>
                    <BookOpen size={12} aria-hidden /> Read it through
                  </Link>
                  <button
                    type="button"
                    className={styles.headLink}
                    onClick={() => useUIStore.getState().setExportOpen(true)}
                  >
                    <Download size={12} aria-hidden /> Export
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {ov && hasContent && <Vitals storyId={storyId} ov={ov} />}
        {ov && hasContent && (
          <div className={styles.grid} data-wide>
            <NeedsYourEye storyId={storyId} />
            <WordsByChapter storyId={storyId} ov={ov} />
          </div>
        )}
        <PlanNextStep storyId={storyId} />
        {hasContent && aiAvailable && <Recap storyId={storyId} />}
        {ov && hasContent && (
          <div className={styles.grid}>
            <CastAndPlaces storyId={storyId} />
            <Lately storyId={storyId} ov={ov} />
          </div>
        )}
        {ov && !hasContent && <StartPaths storyId={storyId} />}
      </div>
    </div>
  );
}
