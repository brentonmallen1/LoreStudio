import { useEffect, useState } from "react";
import { seriesApi, type Series, type SeriesShape } from "../../../api/series";
import { shapePreview } from "../../../lib/series/plan";
import styles from "../../story/CreateStoryDialog.module.css";

/**
 * Ready-made starts for a series' plan, each saying what it would add before it does. "Start
 * blank" is always first: a shape is a suggestion, never the way in.
 */
export default function ShapePicker({
  series,
  value,
  onChange,
}: {
  series: Pick<Series, "books" | "axes">;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [shapes, setShapes] = useState<SeriesShape[]>([]);
  useEffect(() => {
    seriesApi
      .shapes()
      .then(setShapes)
      .catch(() => {});
  }, []);
  const chosen = shapes.find((s) => s.id === value);

  return (
    <fieldset className={styles.begin}>
      <legend className={styles.label}>Start from a shape (optional)</legend>
      {[{ id: null, name: "Start blank", summary: "Plan it your own way, or not at all." }, ...shapes].map(
        (s) => (
          <label
            key={s.id ?? "blank"}
            className={`${styles.beginOption} ${value === s.id ? styles.beginChosen : ""}`}
          >
            <input
              type="radio"
              name="series-shape"
              checked={value === s.id}
              onChange={() => onChange(s.id)}
            />
            <span>
              <span className={styles.beginName}>{s.name}</span>
              <span className={styles.beginHint}>{s.summary}</span>
            </span>
          </label>
        ),
      )}
      {chosen && <p className={styles.templateHint}>{shapePreview(chosen, series)}</p>}
    </fieldset>
  );
}
