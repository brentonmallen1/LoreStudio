import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ago } from "../../lib/serverDate";
import { sectionPath } from "../../lib/routes";
import { WORKING_STYLES, plannedLine, type NextStep } from "../../lib/workingStyle";
import type { StoryOverview, WorkingStyle } from "../../types";
import styles from "./Overview.module.css";

/**
 * The Overview's next step, by how the writer works (doc 29 D8), in place of "Where you left
 * off": a planner is pointed at the first planned scene with no words yet, a discovery writer
 * at the scene they were writing. Each says how the writer works, with a way to change it.
 */
export default function NextStepCard({
  storyId,
  ov,
  style,
  step,
}: {
  storyId: string;
  ov: StoryOverview;
  style: WorkingStyle;
  step: NonNullable<NextStep>;
}) {
  const says = WORKING_STYLES.find((w) => w.id === style)?.says;
  const scene = step.scene;
  const title = scene.title || "Untitled scene";
  const write = `/stories/${storyId}/write/${scene.id}`;
  const outline = `/stories/${storyId}/outline`;
  const recent = ov.recent_scenes[0]?.id === scene.id;
  const excerpt = step.kind === "keep-going" && recent ? (ov.resume_excerpt ?? []) : [];

  return (
    <section className={styles.resume} aria-label="Your next step">
      <div className={styles.resumeHead}>
        <span>
          {says} ·{" "}
          <Link to={sectionPath(storyId, "lorebook", "identity")} className={styles.changeLink}>
            change
          </Link>
        </span>
        {step.kind === "keep-going" && (
          <span>{[ago(scene.updated_at), `${scene.word_count.toLocaleString()} words`].join(" · ")}</span>
        )}
      </div>
      <div className={styles.resumeBody}>
        <h2 className={styles.resumeTitle}>
          {step.kind === "write-planned" ? `Next: write “${title}”` : `Keep going: “${title}”`}
        </h2>
        {step.kind === "write-planned" ? (
          <p className={styles.nextWhy}>{plannedLine(step.planned, title, scene.synopsis)}</p>
        ) : (
          excerpt.map((p, i) => (
            <p key={i} className={styles.resumeLine} data-last={i === excerpt.length - 1 || undefined}>
              {p}
            </p>
          ))
        )}
      </div>
      <div className={styles.resumeActions}>
        <Link to={write} className={styles.continue}>
          {step.kind === "write-planned" ? "Write this scene" : "Continue writing"}{" "}
          <ArrowRight size={14} aria-hidden />
        </Link>
        <Link to={outline} className={styles.secondary}>
          {step.kind === "write-planned" ? "Open the Outline" : "See what you've written"}
        </Link>
      </div>
    </section>
  );
}
