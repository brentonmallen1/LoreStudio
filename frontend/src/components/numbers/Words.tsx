import { STATUS_LABEL, STATUSES } from "../../lib/numbers/charts";
import type { NumbersWords } from "../../types/numbers";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

const FORM_LABEL: Record<string, string> = {
  flash_fiction: "flash fiction",
  short_story: "short story",
  novelette: "novelette",
  novella: "novella",
  novel: "novel",
  epic_saga: "epic",
  series: "series",
};

/** How long the story is, how far along its words are, and how that sits against its form. */
export default function Words({ words }: { words: NumbersWords }) {
  const n = (v: number) => v.toLocaleString();
  const form = FORM_LABEL[words.form];
  const t = words.target;
  return (
    <section className={styles.section} aria-labelledby="numbers-words">
      <SectionHeading section="words" title="Words" />
      <p className={styles.lede}>
        <strong>{n(words.total)}</strong> words in {words.written_scenes} of {words.scenes} scenes
        {words.written_scenes > 0 && (
          <>
            , about {n(words.mean_per_scene)} a scene on average. Half the scenes run longer than{" "}
            {n(words.median_per_scene)}, half shorter (the median).
          </>
        )}
      </p>
      <div className={styles.stack} role="img" aria-label="Words by draft state">
        {STATUSES.map((s) =>
          words.by_status[s] ? (
            <span
              key={s}
              style={{
                width: `${(words.by_status[s] / Math.max(1, words.total)) * 100}%`,
                background: `var(--status-${s})`,
              }}
            />
          ) : null,
        )}
      </div>
      <div className={styles.legend}>
        {STATUSES.map((s) => (
          <span key={s}>
            <i className={styles.swatch} style={{ background: `var(--status-${s})` }} />
            {STATUS_LABEL[s]} {n(words.by_status[s] ?? 0)}
          </span>
        ))}
      </div>
      {t && form && (
        <>
          <div
            className={styles.target}
            data-level={t.warning_level}
            role="img"
            aria-label={`${t.pct}% of a ${form}'s upper length`}
          >
            <div className={styles.targetFill} style={{ width: `${Math.min(100, t.pct)}%` }} />
            {t.soft_warning_at && (
              <span className={styles.ceiling} style={{ left: `${(t.soft_warning_at / t.max) * 100}%` }} />
            )}
          </div>
          <p className={styles.targetNote}>
            {t.warning_level === "exceeded"
              ? `Past the ${n(t.max)} words a ${form} usually runs to.`
              : t.warning_level === "approaching"
                ? `Close to the ${n(t.max)} words a ${form} usually runs to.`
                : `${t.pct}% of the ${n(t.max)} words a ${form} usually runs to.`}
            {words.reads_as &&
              ` At this length it reads as a ${FORM_LABEL[words.reads_as] ?? words.reads_as}.`}
          </p>
        </>
      )}
    </section>
  );
}
