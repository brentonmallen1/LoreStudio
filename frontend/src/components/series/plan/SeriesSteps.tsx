import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Series, SeriesBook } from "../../../api/series";
import type { StoryProgress } from "../../../api/progress";
import { seriesStepProgress, seriesSteps, type SeriesStep } from "../../../lib/series/plan";
import { bookLabel } from "../../../stores/seriesStore";
import StepRail from "../../plan/StepRail";
import ArcStep from "./ArcStep";
import AxesStep from "./AxesStep";
import { ShapePrompt } from "./ShapePicker";
import SlotCell from "./SlotCell";
import CarryIntoBook from "./CarryIntoBook";
import { AddBookForm, RoleField, SeriesField } from "./cells";
import styles from "./SeriesPlan.module.css";

const STEP_KEY = (id: string) => `ls_series_plan_step:${id}`;

function readStep(id: string): string | null {
  try {
    return localStorage.getItem(STEP_KEY(id));
  } catch {
    return null;
  }
}

function writeStep(id: string, step: string) {
  try {
    localStorage.setItem(STEP_KEY(id), step);
  } catch {
    // The step to come back to is a convenience.
  }
}

interface Props {
  series: Series;
  progress: Record<string, StoryProgress>;
  onSeries: (s: Series) => void;
  /** The series' books in order, with moving and taking out (the Overview's list). */
  books: ReactNode;
}

/** The series' plan, a step at a time: the rail a book's Plan uses, over the series. */
export default function SeriesSteps({ series, progress, onSeries, books }: Props) {
  return (
    <StepRail
      label="The series' plan"
      steps={seriesSteps(series)}
      progress={(s) => seriesStepProgress(s, series)}
      renderEditor={(step) => (
        <StepEditor step={step} series={series} progress={progress} onSeries={onSeries} books={books} />
      )}
      initialStep={readStep(series.id)}
      onStepChange={(step) => writeStep(series.id, step)}
      exampleFrom="The Lighthouse Years"
    />
  );
}

function StepEditor({ step, series, progress, onSeries, books }: Props & { step: SeriesStep }) {
  const t = step.target;
  switch (t.kind) {
    case "seriesField":
      return <SeriesField key={t.field} series={series} field={t.field} onSeries={onSeries} />;
    case "books":
      return <BooksStep series={series} progress={progress} onSeries={onSeries} books={books} />;
    case "roles":
      return (
        <div className={styles.stack}>
          {series.books.length === 0 && (
            <p className={styles.note}>Add the books first, in the step before.</p>
          )}
          {series.books.map((b) => (
            <div key={b.story_id} className={styles.bookRow}>
              <span className={styles.ordinal}>{bookLabel(b.position)}</span>
              <div className={styles.stack}>
                <Link to={`/stories/${b.story_id}`} className={styles.bookName}>
                  {b.title}
                </Link>
                <RoleField series={series} book={b} onSeries={onSeries} />
              </div>
            </div>
          ))}
        </div>
      );
    case "arc":
      return <ArcStep series={series} onSeries={onSeries} />;
    case "axes":
      return <AxesStep series={series} onSeries={onSeries} />;
    case "slots":
      return <SlotsStep series={series} onSeries={onSeries} />;
    default:
      return null;
  }
}

/** The books in order, a new planned one, and a planned book's cast from the book before. */
function BooksStep({ series, progress, onSeries, books }: Omit<Props, "step">) {
  const [carrying, setCarrying] = useState<{ book: SeriesBook; from: SeriesBook } | null>(null);
  const unstarted = series.books.filter((b, i) => i > 0 && !(progress[b.story_id]?.word_count ?? 0));
  return (
    <div className={styles.stack}>
      {series.books.length > 0 && books}
      <AddBookForm series={series} onSeries={onSeries} />
      <ShapePrompt series={series} onSeries={onSeries} />
      {unstarted.length > 0 && (
        <p className={styles.note}>
          A book not yet started can take its cast from the book before it:{" "}
          {unstarted.map((b) => (
            <button
              key={b.story_id}
              className={styles.textBtn}
              onClick={() => setCarrying({ book: b, from: series.books[b.position - 1] })}
            >
              Bring into {b.title}
            </button>
          ))}
        </p>
      )}
      {carrying && (
        <CarryIntoBook
          series={series}
          book={carrying.book}
          from={carrying.from}
          onSeries={onSeries}
          onClose={() => setCarrying(null)}
        />
      )}
    </div>
  );
}

/** Every book on every axis, a row per book. */
function SlotsStep({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }) {
  const axes = series.axes ?? [];
  if (series.books.length === 0) return <p className={styles.note}>Add the books first.</p>;
  return (
    <div className={styles.slotGrid} style={{ "--axes": axes.length } as React.CSSProperties}>
      <span />
      {axes.map((a) => (
        <span key={a.id} className={styles.slotHead}>
          {a.label}
        </span>
      ))}
      {series.books.map((b) => (
        <Fragment key={b.story_id}>
          <span className={styles.ordinal} title={b.title}>
            {bookLabel(b.position)}
          </span>
          {axes.map((a) => (
            <SlotCell key={a.id} series={series} book={b} axis={a} onSeries={onSeries} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
