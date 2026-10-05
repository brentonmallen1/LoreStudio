import { useState, type ReactNode } from "react";
import type { StoryProgress } from "../../../api/progress";
import type { Series } from "../../../api/series";
import SeriesBoard from "./SeriesBoard";
import SeriesSteps from "./SeriesSteps";
import styles from "./SeriesPlan.module.css";

type View = "guided" | "board";
const VIEW_KEY = "ls_series_plan_view";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "guided";
  } catch {
    return "guided";
  }
}

/**
 * The series' Plan (series v2): what the books are about together, the books and each one's
 * part, the arc across them. Guided, a step at a time with why each matters; or the Board,
 * every book side by side. Nothing in it is required, and none of it stops anyone writing.
 */
export default function SeriesPlan(props: {
  series: Series;
  progress: Record<string, StoryProgress>;
  onSeries: (s: Series) => void;
  books: ReactNode;
}) {
  const [view, setView] = useState<View>(readView);
  function choose(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Remembered when it can be.
    }
  }
  return (
    <div className={styles.stack}>
      <div className={styles.viewBar} role="group" aria-label="How to plan">
        {(["guided", "board"] as const).map((v) => (
          <button
            key={v}
            className={`${styles.toggle} ${view === v ? styles.toggleOn : ""}`}
            aria-pressed={view === v}
            onClick={() => choose(v)}
          >
            {v === "guided" ? "A step at a time" : "Every book at once"}
          </button>
        ))}
      </div>
      {view === "guided" ? (
        <SeriesSteps {...props} />
      ) : (
        <SeriesBoard series={props.series} progress={props.progress} onSeries={props.onSeries} />
      )}
    </div>
  );
}
