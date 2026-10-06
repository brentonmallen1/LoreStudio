import { Loader2, ScanText } from "lucide-react";
import { ago } from "../../lib/serverDate";
import type { NumbersProse } from "../../types/numbers";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * Prose habits across the book, from the latest local check (doc 13 P3). Measured on this
 * machine with no model, so it is here in Writer mode too, in the local-analysis colour.
 * Compared (doc 19), each figure says what it was and the earlier run's shares are outlines.
 */
export default function Prose({
  prose,
  then,
  running,
  onMeasure,
}: {
  prose: NumbersProse | null;
  /** The earlier side's prose: undefined when not comparing, null when it was not measured then. */
  then?: NumbersProse | null;
  running: boolean;
  onMeasure: () => void;
}) {
  const buckets = prose?.sentence_lengths ?? [];
  const all = buckets.reduce((a, b) => a + b.count, 0);
  const allThen = then?.sentence_lengths.reduce((a, b) => a + b.count, 0) ?? 0;
  const pct = (count: number, of: number) => (of ? (count / of) * 100 : 0);
  const pctThen = (label: string) =>
    pct(then?.sentence_lengths.find((b) => b.label === label)?.count ?? 0, allThen);
  const most = Math.max(
    1,
    ...buckets.map((b) => pct(b.count, all)),
    ...buckets.map((b) => (then ? pctThen(b.label) : 0)),
  );
  const was = (a: number | undefined, b: number, unit = "%") =>
    then && a !== undefined && a !== b ? (
      <span className={styles.was}>
        {" "}
        (was {a}
        {unit})
      </span>
    ) : null;
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
            <strong>{prose.passive_pct}%</strong>
            {was(then?.passive_pct, prose.passive_pct)} of sentences are in the passive,{" "}
            <strong>{prose.adverb_pct}%</strong>
            {was(then?.adverb_pct, prose.adverb_pct)} of words are adverbs, and the average sentence runs{" "}
            <strong>{prose.mean_sentence}</strong>
            {was(then?.mean_sentence, prose.mean_sentence, "")} words. Measured across {prose.scenes}{" "}
            {prose.scenes === 1 ? "scene" : "scenes"}{" "}
            <span className={styles.muted}>{ago(prose.run_at)}</span>; the passages worth a look are in
            Findings.
            {then === null && " It was not measured by the earlier reading."}
            {then && then.run_at === prose.run_at && " Not measured again since the earlier reading."}
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
                    <span className={styles.histValue}>{Math.round(pct(b.count, all))}%</span>
                    {/* As tall as the taller of now and then, so the figure sits above both. */}
                    <span
                      className={styles.histPlot}
                      style={{
                        height: `${(Math.max(pct(b.count, all), then ? pctThen(b.label) : 0) / most) * 100}%`,
                      }}
                    >
                      <span
                        className={styles.histBar}
                        style={{
                          height: `${(pct(b.count, all) / Math.max(1e-9, pct(b.count, all), then ? pctThen(b.label) : 0)) * 100}%`,
                        }}
                      />
                      {then && (
                        <span
                          className={styles.histThen}
                          style={{
                            height: `${(pctThen(b.label) / Math.max(1e-9, pct(b.count, all), pctThen(b.label))) * 100}%`,
                          }}
                          title={`Then: ${Math.round(pctThen(b.label))}%`}
                          aria-hidden
                        />
                      )}
                    </span>
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
