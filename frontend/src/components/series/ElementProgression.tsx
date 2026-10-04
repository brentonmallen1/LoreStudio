import { useEffect, useState } from "react";
import {
  seriesApi,
  type ElementDetail,
  type ElementField,
  type Series,
  type CanonElement as SeriesElement,
} from "../../api/series";
import { fieldLabel, kindLabel } from "../../lib/series/kinds";
import { progressionSteps, stepLabel } from "../../lib/series/progression";
import { toast } from "../../stores/toastStore";
import styles from "./Series.module.css";

/**
 * One element across its books (series doc): what stays true, said once when the books
 * agree and book by book when they do not, each version a click from being every book's;
 * and how it changes, book by book. A field can be moved from one to the other, for every
 * element of its kind in the series. `here` marks the book the reader is in.
 */
export default function ElementProgression({
  series,
  element,
  here,
  onSeries,
}: {
  series: Series;
  element: SeriesElement;
  here?: string;
  /** The series after a change made here. */
  onSeries?: (s: Series) => void;
}) {
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  // Reread when the element's books or the series' field classes change, or after a change made here.
  const readKey = `${element.id}:${element.members.map((m) => m.ref_id).join(",")}:${JSON.stringify(
    series.field_classes[element.kind] ?? {},
  )}:${nonce}`;
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

  async function change(run: () => Promise<Series>, done: string) {
    setBusy(true);
    try {
      onSeries?.(await run());
      setNonce((n) => n + 1);
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (failed)
    return <p className={`${styles.progression} ${styles.quiet}`}>This could not be read just now.</p>;
  if (!detail) return <p className={`${styles.progression} ${styles.quiet}`}>Reading its books…</p>;

  const said = (f: ElementField) => f.values.some((v) => v.value.trim());
  const enduring = detail.fields.filter((f) => f.field_class === "enduring" && said(f));
  const evolving = detail.fields.filter((f) => f.field_class === "evolving" && said(f));
  const title = (storyId: string): string => series.books.find((b) => b.story_id === storyId)?.title ?? "";
  const kinds = kindLabel(element.kind, true).toLowerCase();

  function steps(f: ElementField, choose: boolean) {
    return (
      <ol className={styles.steps}>
        {progressionSteps(f.values).map((step) => (
          <li
            key={step.from}
            className={`${styles.step} ${here && step.storyIds.includes(here) ? styles.stepHere : ""}`}
            title={step.storyIds.map(title).join(", ")}
          >
            <span className={styles.stepBook}>{stepLabel(step)}</span>
            <span>
              {step.value.trim() ? step.value : <span className={styles.blank}>not said</span>}
              {choose && step.value.trim() && (
                <button
                  className={styles.useBtn}
                  disabled={busy}
                  onClick={() =>
                    change(
                      () => seriesApi.propagate(series.id, element.id, f.key, step.storyIds[0]),
                      `Every book now says what ${stepLabel(step)} says`,
                    )
                  }
                >
                  Use this in every book
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  function classSwitch(f: ElementField) {
    const next = f.field_class === "enduring" ? "evolving" : "enduring";
    return (
      <button
        className={styles.classBtn}
        disabled={busy}
        title={`For all ${kinds} in this series`}
        onClick={() =>
          change(
            () => seriesApi.setFieldClass(series.id, element.kind, f.key, next),
            next === "enduring"
              ? `${fieldLabel(element.kind, f.key)} now stays true for all ${kinds} in the series`
              : `${fieldLabel(element.kind, f.key)} can now change from book to book`,
          )
        }
      >
        {next === "enduring" ? "Keep it the same in every book" : "Let it change book to book"}
      </button>
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
            {classSwitch(f)}
          </div>
          {f.differs ? (
            steps(f, true)
          ) : (
            <span className={styles.value}>{f.values.find((v) => v.value.trim())?.value}</span>
          )}
        </div>
      ))}
      {evolving.length > 0 && <p className={styles.groupLabel}>How {element.name} changes, book by book</p>}
      {evolving.map((f) => (
        <div key={f.key} className={styles.fieldBlock}>
          <div className={styles.fieldHead}>
            {fieldLabel(element.kind, f.key)}
            {classSwitch(f)}
          </div>
          {steps(f, false)}
        </div>
      ))}
    </div>
  );
}
