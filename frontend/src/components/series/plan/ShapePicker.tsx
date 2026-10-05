import { useEffect, useState } from "react";
import { seriesApi, type Series, type SeriesShape } from "../../../api/series";
import { shapePreview } from "../../../lib/series/plan";
import { toast } from "../../../stores/toastStore";
import styles from "../../story/CreateStoryDialog.module.css";
import plan from "./SeriesPlan.module.css";

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

/**
 * "Start from a shape", offered while the series has no arc of its own: a shape only starts
 * an arc, never redraws one.
 */
export function ShapePrompt({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }) {
  const [shaping, setShaping] = useState(false);
  const [shape, setShape] = useState<string | null>(null);
  if ((series.arc ?? []).length) return null;
  if (!shaping)
    return (
      <p className={plan.note}>
        Not sure how many books, or how they fit together?{" "}
        <button className={plan.textBtn} onClick={() => setShaping(true)}>
          Start from a shape
        </button>
      </p>
    );
  return (
    <div className={plan.stack}>
      <ShapePicker series={series} value={shape} onChange={setShape} />
      <div className={plan.addRow}>
        <button
          className={plan.btn}
          disabled={!shape}
          onClick={() =>
            shape &&
            seriesApi
              .applyShape(series.id, shape)
              .then((s) => {
                onSeries(s);
                setShaping(false);
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "The shape could not be applied."),
              )
          }
        >
          Use this shape
        </button>
        <button className={plan.textBtn} onClick={() => setShaping(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}
