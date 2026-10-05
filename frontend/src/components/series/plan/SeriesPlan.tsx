import { useState, type ReactNode } from "react";
import type { StoryProgress } from "../../../api/progress";
import type { Series } from "../../../api/series";
import { planIsEmpty } from "../../../lib/series/plan";
import SeriesBoard from "./SeriesBoard";
import SeriesSteps from "./SeriesSteps";
import styles from "./SeriesPlan.module.css";

type View = "board" | "guided";

/**
 * The series' Plan (series v2): the Board, every book side by side with each thing planned
 * for it named on its row; or a walk through it a step at a time, with why each matters. A
 * series with nothing planned yet opens on the walk-through. Nothing in it is required, and
 * none of it stops anyone writing.
 */
export default function SeriesPlan(props: {
  series: Series;
  progress: Record<string, StoryProgress>;
  onSeries: (s: Series) => void;
  books: ReactNode;
}) {
  const [view, setView] = useState<View>(() => (planIsEmpty(props.series) ? "guided" : "board"));
  return (
    <div className={styles.stack}>
      <div className={styles.viewBar} role="group" aria-label="How to plan">
        {(["board", "guided"] as const).map((v) => (
          <button
            key={v}
            className={`${styles.toggle} ${view === v ? styles.toggleOn : ""}`}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v === "board" ? "Board" : "Walk me through it"}
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
