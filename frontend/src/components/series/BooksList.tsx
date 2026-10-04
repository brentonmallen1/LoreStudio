import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { StoryProgress } from "../../api/progress";
import type { Series } from "../../api/series";
import { bookLabel } from "../../stores/seriesStore";
import styles from "./Series.module.css";

/**
 * The books of a series in reading order (series doc). The order is what each book starts
 * from: bringing an element into a book copies it from the nearest book before. A book can
 * leave, keeping everything in it as its own.
 */
export default function BooksList({
  series,
  progress,
  onReorder,
  onLeave,
}: {
  series: Series;
  progress: Record<string, StoryProgress>;
  onReorder: (storyIds: string[]) => void;
  onLeave: (storyId: string) => void;
}) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const ids = series.books.map((b) => b.story_id);

  function move(from: number, to: number) {
    const next = [...ids];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    onReorder(next);
  }

  return (
    <ol className={styles.books}>
      {series.books.map((b, i) => {
        const words = progress[b.story_id]?.word_count ?? 0;
        return (
          <li key={b.story_id} className={styles.book}>
            <span className={styles.ordinal}>{bookLabel(b.position)}</span>
            <Link to={`/stories/${b.story_id}`} className={styles.bookTitle}>
              {b.title}
            </Link>
            <span className={styles.bookMeta}>
              {words > 0 ? `${words.toLocaleString()} words` : "not started"}
            </span>
            <button
              className={styles.iconBtn}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              aria-label={`Move ${b.title} earlier`}
              title="Earlier in the series"
            >
              <ArrowUp size={14} />
            </button>
            <button
              className={styles.iconBtn}
              disabled={i === series.books.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label={`Move ${b.title} later`}
              title="Later in the series"
            >
              <ArrowDown size={14} />
            </button>
            {leaving === b.story_id ? (
              <>
                <button className={styles.textBtn} onClick={() => onLeave(b.story_id)}>
                  Take it out
                </button>
                <button className={styles.textBtn} onClick={() => setLeaving(null)}>
                  Keep it
                </button>
              </>
            ) : (
              <button
                className={styles.textBtn}
                onClick={() => setLeaving(b.story_id)}
                title="The book keeps its characters, places and world as its own"
              >
                Take out of the series
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
