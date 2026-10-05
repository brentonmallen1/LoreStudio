import { Link } from "react-router-dom";
import type { Series, SeriesFinding } from "../../api/series";
import { sheetPath } from "../../lib/series/kinds";
import { bookLabel } from "../../stores/seriesStore";
import styles from "./Series.module.css";

/**
 * The series' Needs your eye: where the books disagree, threads left open between them, and
 * books that stray from the plan. Each row leads to where it can be settled: the Canon's
 * comparison, a thread's sheet, or the findings of the book it is about.
 */
export default function SeriesEye({
  series,
  findings,
  onCompare,
}: {
  series: Series;
  findings: SeriesFinding[];
  onCompare: (elementId: string) => void;
}) {
  if (findings.length === 0) return null;
  const book = (storyId: string) =>
    bookLabel(series.books.find((b) => b.story_id === storyId)?.position ?? 0);
  return (
    <section className={styles.section} aria-labelledby="series-eye">
      <div className={styles.sectionHead}>
        <h2 id="series-eye" className={styles.sectionTitle}>
          Needs your eye
        </h2>
        <p className={styles.sectionNote}>
          Where the books disagree about what should stay true, threads across them left open, opened twice or
          crossing, and books that stray from the plan. Dismissing one in any book dismisses it in all.
        </p>
      </div>
      <ul className={styles.eyeList}>
        {findings.map((f) => (
          <li key={f.id} className={styles.eyeRow}>
            <span className={styles.eyeText}>
              {f.text}
              {f.suggestion && <span className={styles.eyeEvidence}>{f.suggestion}</span>}
            </span>
            {f.check === "series-canon" && f.element_id ? (
              <button className={styles.textBtn} onClick={() => onCompare(f.element_id as string)}>
                Compare the books
              </button>
            ) : f.ref_id ? (
              <Link className={styles.textBtn} to={sheetPath(f.story_ids[0], "plot_thread", f.ref_id)}>
                Open in {book(f.story_ids[0])}
              </Link>
            ) : (
              f.story_ids[0] && (
                <Link className={styles.textBtn} to={`/stories/${f.story_ids[0]}/findings`}>
                  Open in {book(f.story_ids[0])}
                </Link>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
