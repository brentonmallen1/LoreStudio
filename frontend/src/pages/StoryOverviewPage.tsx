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
import { RecapCard, RecapTrigger } from "../components/overview/Recap";
import { useRecap } from "../components/overview/useRecap";
import StartPaths from "../components/overview/StartPaths";
import PlanNextStep from "../components/plan/PlanNextStep";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { sectionPath } from "../lib/routes";
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
  const [failed, setFailed] = useState(false);
  const recap = useRecap(storyId);
  const load = () =>
    api.getStoryOverview(storyId).then(
      (o) => {
        setOv(o);
        setFailed(false);
      },
      () => setFailed(true),
    );
  useEffect(() => {
    void load();
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
  // What the story is, as facts to read rather than chips to press (doc 14 Overview).
  const facts = [
    story.genre,
    story.tone,
    LENGTH_LABELS[story.intended_length ?? ""] ?? story.intended_length,
  ].filter((f): f is string => !!f);

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{story.title}</h1>
            {line && <p className={styles.logline}>{line}</p>}
            {facts.length > 0 && (
              <p className={styles.facts}>
                {facts.join(" · ")}
                <Link to={sectionPath(storyId, "lorebook", "identity")} className={styles.inlineLink}>
                  Edit
                </Link>
              </p>
            )}
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
                  <Link to={`/stories/${storyId}/publish`} className={styles.heroAction}>
                    <BookOpen size={12} aria-hidden /> Read it through
                  </Link>
                  <button
                    type="button"
                    className={styles.heroAction}
                    onClick={() => useUIStore.getState().setExportOpen(true)}
                  >
                    <Download size={12} aria-hidden /> Export
                  </button>
                  {aiAvailable && <RecapTrigger recap={recap} />}
                </div>
              )}
            </div>
          )}
        </header>
        {hasContent && aiAvailable && <RecapCard recap={recap} />}

        {failed && !ov && (
          <p className={styles.quiet} role="alert">
            The story's figures did not load.{" "}
            <button type="button" className={styles.headLink} onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {ov && hasContent && <Vitals storyId={storyId} ov={ov} />}
        {ov && hasContent ? (
          // Two columns with a job each (doc 14 Overview): on the left what to act on, on
          // the right what to know.
          <div className={styles.columns}>
            <div className={styles.col} aria-label="What to do next">
              <NeedsYourEye storyId={storyId} />
              <PlanNextStep storyId={storyId} />
              <Lately storyId={storyId} ov={ov} />
            </div>
            <div className={styles.col} aria-label="The story at a glance">
              <WordsByChapter storyId={storyId} ov={ov} />
              <CastAndPlaces storyId={storyId} />
            </div>
          </div>
        ) : (
          <PlanNextStep storyId={storyId} />
        )}
        {ov && !hasContent && <StartPaths storyId={storyId} />}
      </div>
    </div>
  );
}
