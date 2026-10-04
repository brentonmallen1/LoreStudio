import { useEffect, useState } from "react";
import {
  seriesApi,
  type ElementDetail,
  type ElementField,
  type Series,
  type SeriesElement,
} from "../../api/series";
import { fieldLabel } from "../../lib/series/kinds";
import { progressionSteps, stepLabel } from "../../lib/series/progression";
import styles from "./Series.module.css";

/**
 * One element across its books (series doc): what stays true, said once when the books
 * agree and book by book when they do not; and how it changes, book by book. `here` marks
 * the book the reader is in.
 */
export default function ElementProgression({
  series,
  element,
  here,
}: {
  series: Series;
  element: SeriesElement;
  here?: string;
}) {
  // Reread when the element's books change (brought into a book, taken out of one).
  const readKey = `${element.id}:${element.members.map((m) => m.ref_id).join(",")}`;
  const [read, setRead] = useState<{ key: string; detail: ElementDetail | null } | null>(null);
  const detail = read?.key === readKey ? read.detail : null;
  const failed = read?.key === readKey && read.detail === null;

  useEffect(() => {
    let live = true;
    seriesApi
      .element(series.id, element.id)
      .then((d) => live && setRead({ key: readKey, detail: d }))
      .catch(() => live && setRead({ key: readKey, detail: null }));
    return () => {
      live = false;
    };
  }, [series.id, element.id, readKey]);

  if (failed)
    return <p className={`${styles.progression} ${styles.quiet}`}>This could not be read just now.</p>;
  if (!detail) return <p className={`${styles.progression} ${styles.quiet}`}>Reading its books…</p>;

  const said = (f: ElementField) => f.values.some((v) => v.value.trim());
  const enduring = detail.fields.filter((f) => f.field_class === "enduring" && said(f));
  const evolving = detail.fields.filter((f) => f.field_class === "evolving" && said(f));
  const title = (storyId: string): string => series.books.find((b) => b.story_id === storyId)?.title ?? "";

  function steps(f: ElementField) {
    return (
      <ol className={styles.steps}>
        {progressionSteps(f.values).map((step) => (
          <li
            key={step.from}
            className={`${styles.step} ${here && step.storyIds.includes(here) ? styles.stepHere : ""}`}
            title={step.storyIds.map(title).join(", ")}
          >
            <span className={styles.stepBook}>{stepLabel(step)}</span>
            {step.value.trim() ? <span>{step.value}</span> : <span className={styles.blank}>not said</span>}
          </li>
        ))}
      </ol>
    );
  }

  if (enduring.length === 0 && evolving.length === 0)
    return (
      <p className={`${styles.progression} ${styles.quiet}`}>Nothing written about {element.name} yet.</p>
    );

  return (
    <div className={styles.progression}>
      {enduring.length > 0 && <p className={styles.groupLabel}>Stays true across the series</p>}
      {enduring.map((f) => (
        <div key={f.key} className={styles.fieldBlock}>
          <div className={styles.fieldHead}>
            {fieldLabel(element.kind, f.key)}
            {f.differs && <span className={`${styles.classChip} ${styles.differs}`}>the books disagree</span>}
          </div>
          {f.differs ? (
            steps(f)
          ) : (
            <span className={styles.value}>{f.values.find((v) => v.value.trim())?.value}</span>
          )}
        </div>
      ))}
      {evolving.length > 0 && <p className={styles.groupLabel}>How {element.name} changes, book by book</p>}
      {evolving.map((f) => (
        <div key={f.key} className={styles.fieldBlock}>
          <div className={styles.fieldHead}>{fieldLabel(element.kind, f.key)}</div>
          {steps(f)}
        </div>
      ))}
    </div>
  );
}
