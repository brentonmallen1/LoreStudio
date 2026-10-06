import { Loader2, ScanText } from "lucide-react";
import { ago } from "../../lib/serverDate";
import type { NumbersProse } from "../../types/numbers";
import SectionHeading from "./SectionHeading";
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
  const buckets = prose?.sentence_lengths ?? [];
  const most = Math.max(1, ...buckets.map((b) => b.count));
  const all = buckets.reduce((a, b) => a + b.count, 0);
  const button = (
    <button type="button" className={styles.verb} onClick={onMeasure} disabled={running}>
      {running ? <Loader2 size={13} aria-hidden /> : <ScanText size={13} aria-hidden />}
      {running ? "Measuring…" : prose ? "Measure again" : "Measure the prose"}
    </button>
  );
  return (
    <section className={styles.section} aria-labelledby="numbers-prose">
      <SectionHeading section="prose" title="Prose" tone="nlp" />
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
          {all > 0 && (
            <figure className={styles.histogram}>
              <span className={styles.histAxis}>% of {all.toLocaleString()} sentences</span>
              <div className={styles.histCols} role="img" aria-label="Share of sentences by length in words">
                {buckets.map((b) => (
                  <div
                    key={b.label}
                    className={styles.histCol}
                    title={`${b.count} sentences of ${b.label} words`}
                  >
                    <span className={styles.histValue}>{Math.round((b.count / all) * 100)}%</span>
                    <span className={styles.histBar} style={{ height: `${(b.count / most) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className={styles.histLabels} aria-hidden>
                {buckets.map((b) => (
                  <span key={b.label}>{b.label}</span>
                ))}
              </div>
              <figcaption className={styles.histAxis} data-x>
                Words per sentence
              </figcaption>
            </figure>
          )}
          <p className={styles.lede}>{button}</p>
        </>
      )}
    </section>
  );
}
