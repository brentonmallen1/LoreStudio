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
import ResumeCard from "../components/overview/ResumeCard";
import StartPaths from "../components/overview/StartPaths";
import PlanNextStep from "../components/plan/PlanNextStep";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { sectionPath } from "../lib/routes";
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
  const story = useStoryStore((s) => s.activeStory);
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
          {hasContent && (
            <div className={styles.heroLinks}>
              <Link to={`/stories/${storyId}/publish`} className={styles.heroAction}>
                <BookOpen size={13} aria-hidden /> Read it through
              </Link>
              <button
                type="button"
                className={styles.heroAction}
                onClick={() => useUIStore.getState().setExportOpen(true)}
              >
                <Download size={13} aria-hidden /> Export
              </button>
              {aiAvailable && <RecapTrigger recap={recap} />}
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
        {ov && hasContent ? (
          // The desk (doc 14 Overview): on the left, the scene to pick up and what to do;
          // on the right, the figures and who is in it, quieter so the left leads.
          <div className={styles.desk}>
            <div className={styles.col} aria-label="What to do next">
              <ResumeCard storyId={storyId} ov={ov} />
              <NeedsYourEye storyId={storyId} />
              <Lately storyId={storyId} ov={ov} />
            </div>
            <aside className={styles.col} aria-label="The story at a glance">
              <Vitals storyId={storyId} ov={ov} />
              <WordsByChapter storyId={storyId} ov={ov} />
              <CastAndPlaces storyId={storyId} />
            </aside>
          </div>
        ) : (
          <PlanNextStep storyId={storyId} />
        )}
        {ov && !hasContent && <StartPaths storyId={storyId} />}
      </div>
    </div>
  );
}
