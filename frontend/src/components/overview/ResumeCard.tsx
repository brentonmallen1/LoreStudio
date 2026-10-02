import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { flattenStructure } from "../editor/segmentMeta";
import { sceneLeaves } from "../../lib/planning/methods";
import { ago } from "../../lib/serverDate";
import { useStoryStore } from "../../stores/storyStore";
import type { StoryOverview } from "../../types";
import styles from "./Overview.module.css";

/**
 * Where you left off (doc 14 Overview, "the desk"): the scene edited last, its closing
 * lines in the writer's own words, and one button to go on. What the card says is text;
 * the only things to press are the two at its foot.
 */
export default function ResumeCard({ storyId, ov }: { storyId: string; ov: StoryOverview }) {
  const { structure, activeTemplate } = useStoryStore();
  const recent = ov.recent_scenes[0];
  if (!recent)
    return (
      <section className={styles.resume} aria-label="Start writing">
        <div className={styles.resumeHead}>Scenes are laid out; none has words yet.</div>
        <div className={styles.resumeActions}>
          <Link to={`/stories/${storyId}/write`} className={styles.continue}>
            Start writing <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
    );
  const flat = flattenStructure(structure);
  const parentId = flat.find((s) => s.id === recent.id)?.parent_id;
  const chapter = parentId ? flat.find((n) => n.id === parentId)?.title : undefined;
  const leaves = sceneLeaves(structure, activeTemplate);
  const next = leaves[leaves.findIndex((s) => s.id === recent.id) + 1];
  const excerpt = ov.resume_excerpt ?? [];
  const words = `${recent.word_count.toLocaleString()} ${recent.word_count === 1 ? "word" : "words"}`;

  return (
    <section className={styles.resume} aria-label="Where you left off">
      <div className={styles.resumeHead}>
        <span>
          Where you left off
          {chapter && (
            <>
              {" · "}
              <span className={styles.resumeChapter}>{chapter}</span>
            </>
          )}
        </span>
        <span>{[ago(recent.updated_at), words, recent.status].join(" · ")}</span>
      </div>
      <div className={styles.resumeBody}>
        <h2 className={styles.resumeTitle}>{recent.title || "Untitled scene"}</h2>
        {excerpt.map((p, i) => (
          <p key={i} className={styles.resumeLine} data-last={i === excerpt.length - 1 || undefined}>
            {p}
          </p>
        ))}
      </div>
      <div className={styles.resumeActions}>
        <Link to={`/stories/${storyId}/write/${recent.id}`} className={styles.continue}>
          Continue writing <ArrowRight size={16} aria-hidden />
        </Link>
        {next && (
          <Link to={`/stories/${storyId}/write/${next.id}`} className={styles.nextScene}>
            Next scene: {next.title || "Untitled scene"}
          </Link>
        )}
      </div>
    </section>
  );
}
