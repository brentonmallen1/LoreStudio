import { useState } from "react";
import { writtenApi } from "../../../api/written";
import { jumpsLine, longRule } from "../../../lib/written/offers";
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
  return (
    <section className={styles.tidy} aria-labelledby="written-tidy">
      <h3 id="written-tidy" className={styles.heading}>
        When you're ready to tidy up
      </h3>
      {offers.length === 0 && (
        <p className={styles.quiet}>
          Nothing to tidy right now. LoreStudio looks for long scenes where the time jumps, and offers to
          split them there.
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
    </section>
  );
}
