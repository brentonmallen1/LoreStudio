import { Loader2, ScanText } from "lucide-react";
import { ago } from "../../lib/serverDate";
import type { NumbersProse } from "../../types/numbers";
import styles from "./Numbers.module.css";

/**
 * Prose habits across the book, from the latest local check (doc 13 P3). Measured on this
 * machine with no model, so it is here in Writer mode too, in the local-analysis colour.
 */
export default function Prose({
  prose,
  running,
  onMeasure,
}: {
  prose: NumbersProse | null;
  running: boolean;
  onMeasure: () => void;
}) {
  const most = Math.max(1, ...(prose?.sentence_lengths.map((b) => b.count) ?? [1]));
  const button = (
    <button type="button" className={styles.verb} onClick={onMeasure} disabled={running}>
      {running ? <Loader2 size={13} aria-hidden /> : <ScanText size={13} aria-hidden />}
      {running ? "Measuring…" : prose ? "Measure again" : "Measure the prose"}
    </button>
  );
  return (
    <section className={styles.section} aria-labelledby="numbers-prose">
      <h2 className={styles.heading} data-tone="nlp" id="numbers-prose">
        Prose
      </h2>
      {!prose ? (
        <>
          <p className={styles.lede}>
            Passive voice, adverbs and how long the sentences run have not been measured yet. It takes a
            moment and happens on this machine.
          </p>
          {button}
        </>
      ) : (
        <>
          <p className={styles.lede}>
            <strong>{prose.passive_pct}%</strong> of sentences are in the passive,{" "}
            <strong>{prose.adverb_pct}%</strong> of words are adverbs, and the average sentence runs{" "}
            <strong>{prose.mean_sentence}</strong> words. Measured across {prose.scenes}{" "}
            {prose.scenes === 1 ? "scene" : "scenes"}{" "}
            <span className={styles.muted}>{ago(prose.run_at)}</span>; the passages worth a look are in
            Findings.
          </p>
          {prose.sentence_lengths.length > 0 && (
            <div className={styles.histogram} role="img" aria-label="Sentences by length in words">
              {prose.sentence_lengths.map((b) => (
                <div key={b.label} title={`${b.count} sentences of ${b.label} words`}>
                  <span style={{ height: `${(b.count / most) * 100}%` }} />
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          )}
          <p className={styles.lede}>{button}</p>
        </>
      )}
    </section>
  );
}
