import { Link } from "react-router-dom";
import type { StoryProgress } from "../../../api/progress";
import type { Series } from "../../../api/series";
import { bookLabel } from "../../../stores/seriesStore";
import { AddBookForm, BeatChips, RoleField } from "./cells";
import SlotCell from "./SlotCell";
import styles from "./SeriesPlan.module.css";

/**
 * The series on one board: a column per book, its part, where it stands on each axis (its
 * viewpoint, its era) and the arc beats it carries, and a last column for the next book. For the author who would rather see it all at once than go
 * a step at a time; both write the same plan.
 */
export default function SeriesBoard({
  series,
  progress,
  onSeries,
}: {
  series: Series;
  progress: Record<string, StoryProgress>;
  onSeries: (s: Series) => void;
}) {
  return (
    <div className={styles.boardScroll}>
      <div className={styles.board} role="list" aria-label={`The books of ${series.name}`}>
        {series.books.map((b) => {
          const words = progress[b.story_id]?.word_count ?? 0;
          return (
            <section key={b.story_id} className={styles.column} role="listitem" aria-label={b.title}>
              <header className={styles.columnHead}>
                <span className={styles.ordinal}>{bookLabel(b.position)}</span>
                <Link to={`/stories/${b.story_id}`} className={styles.bookName}>
                  {b.title}
                </Link>
                <span className={styles.columnMeta}>
                  {words > 0 ? `${words.toLocaleString()} words` : "planned"}
                </span>
              </header>
              <div className={styles.cellBlock}>
                <span className={styles.rowLabel}>Its part</span>
                <RoleField series={series} book={b} onSeries={onSeries} rows={3} />
              </div>
              {(series.axes ?? []).map((a) => (
                <div key={a.id} className={styles.cellBlock}>
                  <span className={styles.rowLabel}>{a.label}</span>
                  <SlotCell series={series} book={b} axis={a} onSeries={onSeries} />
                </div>
              ))}
              <div className={styles.cellBlock}>
                <span className={styles.rowLabel}>The arc</span>
                <BeatChips series={series} book={b} onSeries={onSeries} />
              </div>
            </section>
          );
        })}
        <section className={styles.addColumn} role="listitem" aria-label="The next book">
          <span className={styles.rowLabel}>
            {series.books.length === 0 ? "The first book" : "The next book"}
          </span>
          <AddBookForm series={series} onSeries={onSeries} stacked />
        </section>
      </div>
    </div>
  );
}
