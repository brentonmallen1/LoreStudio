import { Link } from "react-router-dom";
import { formatEighths } from "../../lib/script/syntax";
import type { NumbersPages } from "../../types/numbers";
import { lengthForm } from "../../utils/wordCount";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * A script's length in pages (doc 25, P5): the PDF's own count against its form, each act's
 * share, how much is speech, and the scenes that run past three pages.
 */
export default function Pages({ storyId, pages }: { storyId: string; pages: NumbersPages }) {
  const t = pages.target;
  const form = lengthForm(pages.form)?.phrase;
  const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "page" : "pages"}`;
  return (
    <section className={styles.section} aria-labelledby="numbers-pages">
      <SectionHeading section="pages" title="Pages" />
      <p className={styles.lede}>
        <strong>{plural(pages.total)}</strong>, about{" "}
        {pages.total === 1 ? "a minute" : `${pages.total} minutes`} on screen. {pages.dialogue_pct}% of it is
        speech, the rest action.
        {pages.mean_eighths > 0 && <> A scene runs {formatEighths(pages.mean_eighths)} on average.</>}
      </p>
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
              ? `Past the ${t.max} pages a ${form} usually runs to.`
              : t.warning_level === "approaching"
                ? `Close to the ${t.max} pages a ${form} usually runs to.`
                : `${t.pct}% of the ${t.max} pages a ${form} usually runs to.`}
            {t.min && pages.total < t.min ? ` A ${form} usually runs at least ${t.min}.` : ""}
          </p>
        </>
      )}
      {pages.by_part.length > 1 && (
        <p className={styles.lede}>{pages.by_part.map((p) => `${p.title} about ${p.pages}`).join(" · ")}</p>
      )}
      {pages.long_scenes.length > 0 && (
        <p className={styles.lede}>
          Over three pages:{" "}
          {pages.long_scenes.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link to={`/stories/${storyId}/write/${s.id}`}>{s.title}</Link> ({formatEighths(s.eighths)})
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}
