import { useEffect, useState } from "react";
import { proseChecksApi } from "../../../api/tools";
import type { PassageFinding } from "../../../types";
import styles from "./AttributionChecks.module.css";

/** A dialogue tag with an adverb on it: "said quietly", "softly asked". */
const TAG_ADVERB =
  /\b(said|asked|replied|answered|whispered|called)\s+\w+ly\b|\b\w+ly\s+(said|asked|replied|answered)\b/i;

/**
 * How this scene's dialogue is attributed: said-bookisms ("she hissed") and adverbs on
 * dialogue tags ("said quietly"). The spaCy report had them; the Dialogue view, where the
 * author is looking at attribution, did not. Local and deterministic, so in both modes.
 */
export default function AttributionChecks({ storyId, nodeId }: { storyId: string; nodeId: string }) {
  const [findings, setFindings] = useState<{ bookisms: PassageFinding[]; adverbs: PassageFinding[] } | null>(
    null,
  );

  useEffect(() => {
    let live = true;
    proseChecksApi
      .run(storyId, [nodeId], ["said_bookisms", "adverb_overuse"])
      .then((r) => {
        const scene = r.scenes[0];
        if (!live) return;
        setFindings({
          bookisms: scene?.said_bookisms?.findings ?? [],
          adverbs: (scene?.adverb_overuse?.findings ?? []).filter((f) => TAG_ADVERB.test(f.passage)),
        });
      })
      .catch(() => live && setFindings({ bookisms: [], adverbs: [] }));
    return () => {
      live = false;
    };
  }, [storyId, nodeId]);

  if (!findings) return null;
  const all = [...findings.bookisms, ...findings.adverbs];
  return (
    <details className={styles.checks} open={all.length > 0 && all.length <= 4}>
      <summary>
        Attribution · {findings.bookisms.length} said-bookism{findings.bookisms.length === 1 ? "" : "s"} ·{" "}
        {findings.adverbs.length} adverb{findings.adverbs.length === 1 ? "" : "s"} on tags
      </summary>
      {all.length === 0 ? (
        <p className={styles.none}>Tags are plain: "said" does its job and gets out of the way.</p>
      ) : (
        <ul>
          {all.map((f, i) => (
            <li key={`${f.char_offset}-${i}`}>
              <span className={styles.passage}>“{f.passage}”</span>
              <span className={styles.why}>{f.suggestion || f.explanation}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
