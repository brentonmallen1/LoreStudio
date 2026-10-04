import { Link } from "react-router-dom";
import { sheetPath } from "../../lib/series/kinds";
import { stepWords } from "../../lib/series/promises";
import { usePromises } from "../../lib/promises/usePromises";
import { bookLabel } from "../../stores/seriesStore";
import styles from "./Series.module.css";

/**
 * A thread or twist across the books of its series (series doc, v1.5): what each book does
 * with it, read from that book's own scenes. Book 1 opens it, Book 2 turns it, Book 3 closes
 * it. Each book opens its own sheet; `storyId` is the book the reader is in.
 */
export default function PromiseAcross({
  storyId,
  refId,
  kind,
}: {
  storyId: string;
  refId: string;
  kind: "thread" | "twist";
}) {
  const { data } = usePromises(storyId);
  const across = data?.across[refId];
  if (!data) return <p className={`${styles.progression} ${styles.quiet}`}>Reading the books…</p>;
  if (!across) return null;
  return (
    <div className={styles.progression}>
      <p className={styles.groupLabel}>What each book does with it</p>
      <ol className={styles.steps}>
        {across.books.map((step) => (
          <li
            key={step.story_id}
            className={`${styles.step} ${step.story_id === storyId ? styles.stepHere : ""}`}
          >
            <span className={styles.stepBook}>
              {step.story_id === storyId ? (
                `${bookLabel(step.position)}, here`
              ) : (
                <Link to={sheetPath(step.story_id, kind === "thread" ? "plot_thread" : "twist", step.ref_id)}>
                  {bookLabel(step.position)}
                </Link>
              )}
            </span>
            <span>{stepWords(step, kind)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
