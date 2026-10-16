import { useState } from "react";
import { writtenApi } from "../../../api/written";
import { navigateTo } from "../../../lib/navigation";
import { CHOOSE_HINT } from "../../../lib/outline/selection";
import { jumpsLine, longRule, manyRule } from "../../../lib/written/offers";
import { showThePlaces } from "../../../lib/written/showPlaces";
import { toast } from "../../../stores/toastStore";
import type { WrittenOut } from "../../../types/written";
import styles from "./Written.module.css";

/**
 * When you're ready to tidy up (doc 29 D6): offers to organize what is written, each with the rule
 * it was found by and "Not now", which the story keeps. Nothing changes until the writer says so.
 */
export default function TidyUp({
  storyId,
  data,
  onChanged,
}: {
  storyId: string;
  data: WrittenOut;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function later(key: string) {
    setBusy(key);
    try {
      await writtenApi.notNow(storyId, key);
      onChanged();
    } catch {
      toast.error("That offer could not be put off. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }
  const offers = data.split_offers;
  const chapters = data.chapters_offers;
  return (
    <section className={styles.tidy} aria-labelledby="written-tidy">
      <h3 id="written-tidy" className={styles.heading}>
        When you're ready to tidy up
      </h3>
      {offers.length === 0 && chapters.length === 0 && (
        <p className={styles.quiet}>
          Nothing to tidy right now. LoreStudio looks for long scenes where the time jumps, and chapters that
          hold a lot of scenes.
        </p>
      )}
      {offers.map((o) => (
        <div key={o.node_id} className={styles.offer}>
          <p className={styles.offerText}>
            <strong>{o.title} is long</strong> ({o.words.toLocaleString()} words). {jumpsLine(o.jumps)} Split
            it there?
          </p>
          <p className={styles.rule}>{longRule(o.long_scene_words)}</p>
          <span className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => showThePlaces(storyId, o)}>
              Show me the places
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy === `split:${o.node_id}`}
              onClick={() => void later(`split:${o.node_id}`)}
            >
              Not now
            </button>
          </span>
        </div>
      ))}
      {chapters.map((c) => (
        <div key={c.part_id} className={styles.offer}>
          <p className={styles.offerText}>
            <strong>
              “{c.title}” holds {c.scenes} scenes.
            </strong>{" "}
            That's fine. When you want more {c.level}s, choose some of its scenes in the Outline and wrap them
            in a {c.level} of their own.
          </p>
          <p className={styles.rule}>{manyRule(c.many_scenes, c.level)}</p>
          <span className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                navigateTo(`/stories/${storyId}/outline?view=list`);
                toast.info(CHOOSE_HINT);
              }}
            >
              Make {c.level}s
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy === `chapters:${c.part_id}`}
              onClick={() => void later(`chapters:${c.part_id}`)}
            >
              Not now
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}
