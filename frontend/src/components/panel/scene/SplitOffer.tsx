import { useEffect, useState } from "react";
import { writtenApi } from "../../../api/written";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { jumpsLine, longRule } from "../../../lib/written/offers";
import { toast } from "../../../stores/toastStore";
import type { SplitOffer as Offer } from "../../../types/written";
import { showThePlaces } from "../../../lib/written/showPlaces";
import styles from "./SplitOffer.module.css";

/**
 * "Split it there?" in the This scene tab (doc 29 D6): a long scene where the time jumps, with
 * the rule it was found by. Show me the places lights them in the prose; Not now is kept.
 */
export default function SplitOffer({
  storyId,
  nodeId,
  words,
}: {
  storyId: string;
  nodeId: string;
  words: number;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const load = () => writtenApi.splitOffer(nodeId).then(setOffer, () => setOffer(null));
  useEffect(() => {
    void load();
    // A scene's words change as it is written: look again when the count moves a lot.
  }, [nodeId, Math.floor(words / 250)]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnUndo(["proposal_decline", "structure_node"], load);
  if (!offer) return null;

  async function later() {
    try {
      await writtenApi.notNow(storyId, `split:${nodeId}`);
      setOffer(null);
    } catch {
      toast.error("That offer could not be put off. Try again in a moment.");
    }
  }

  return (
    <section className={styles.offer} aria-label="Split it there?">
      <p className={styles.text}>
        <strong>This scene is long</strong> ({offer.words.toLocaleString()} words). {jumpsLine(offer.jumps)}{" "}
        Split it there?
      </p>
      <p className={styles.rule}>{longRule(offer.long_scene_words)}</p>
      <span className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => showThePlaces(storyId, offer)}>
          Show me the places
        </button>
        <button type="button" className={styles.secondary} onClick={() => void later()}>
          Not now
        </button>
      </span>
    </section>
  );
}
