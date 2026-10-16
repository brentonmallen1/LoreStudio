import { useState } from "react";
import { Settings2 } from "lucide-react";
import type { Story, StoryStructureTemplate } from "../../types";
import { outlineHint } from "../../lib/starterOutline";
import { SHAPES_SHOWN, shapeKnownAs, shapeLine, shapeName } from "../../lib/storyShapes";
import styles from "./CreateStoryDialog.module.css";

export interface SeriesChoice {
  /** The stories a sequel may follow (no tutorials). */
  candidates: Story[];
  sequelOf: string;
  setSequelOf: (id: string) => void;
  previous: Story | null;
  /** The series the chosen book is already in, if it is in one. */
  seriesOf: string | null;
  firstOfSeries: boolean;
  setFirstOfSeries: (on: boolean) => void;
  seriesName: string;
  setSeriesName: (name: string) => void;
  title: string;
}

interface Props {
  offered: StoryStructureTemplate[];
  templateId: string;
  onTemplate: (id: string) => void;
  scaffold: boolean;
  onScaffold: (on: boolean) => void;
  description: string;
  onDescription: (text: string) => void;
  onManage: () => void;
  series: SeriesChoice;
  /** Open from the start: a sequel's door opens the dialog with its book chosen. */
  defaultOpen: boolean;
}

/**
 * New Story's "More options" (doc 29 P1): a shape to start from, in plain words with Freeform
 * as fine as any, whether to lay out its first outline, a line about the story, and whether
 * it belongs to a series or follows one of the writer's books. Folded, its summary says what
 * is chosen.
 */
export default function NewStoryMore(props: Props) {
  const { offered, templateId, series } = props;
  const [inSeries, setInSeries] = useState(props.defaultOpen && !!series.sequelOf);
  const [allShapes, setAllShapes] = useState(false);
  const selected = offered.find((t) => t.id === templateId);
  const at = offered.findIndex((t) => t.id === templateId);
  const shown = allShapes || at >= SHAPES_SHOWN ? offered : offered.slice(0, SHAPES_SHOWN);
  const more = offered.length - shown.length;
  const belongs = series.previous
    ? `after “${series.previous.title}”`
    : series.firstOfSeries
      ? "the first of a series"
      : "not part of a series";

  function toggleSeries(on: boolean) {
    setInSeries(on);
    if (!on) {
      series.setSequelOf("");
      series.setFirstOfSeries(false);
    }
  }

  return (
    <details className={styles.more} open={props.defaultOpen || undefined}>
      <summary className={styles.moreSummary}>
        More options{" "}
        <span className={styles.moreMeta}>
          · shape: {selected ? shapeName(selected) : "Freeform"} · {belongs}
        </span>
      </summary>
      <div className={styles.moreBody}>
        <div className={styles.field}>
          <span className={styles.question}>A shape to start from</span>
          <span className={styles.questionHint}>
            A shape is just names for the big parts of your story. <strong>Freeform</strong> is fine; you can
            add parts later.
          </span>
          <div className={styles.shapes} role="radiogroup" aria-label="A shape to start from">
            {shown.map((t) => (
              <label key={t.id} className={`${styles.shape} ${t.id === templateId ? styles.shapeOn : ""}`}>
                <input
                  type="radio"
                  name="shape"
                  checked={t.id === templateId}
                  onChange={() => props.onTemplate(t.id)}
                />
                <span>
                  <strong>{shapeName(t)}</strong>
                  {!t.is_system && " (yours)"}
                  {shapeLine(t) && <span className={styles.shapeLine}> · {shapeLine(t)}</span>}
                  {shapeKnownAs(t) && <span className={styles.shapeKnown}> Known as {shapeKnownAs(t)}.</span>}
                </span>
              </label>
            ))}
          </div>
          <div className={styles.shapeFoot}>
            {more > 0 && (
              <button type="button" className={styles.linkBtn} onClick={() => setAllShapes(true)}>
                {more} more {more === 1 ? "shape" : "shapes"}
              </button>
            )}
            <button type="button" className={styles.linkBtn} onClick={props.onManage}>
              <Settings2 size={12} aria-hidden /> Make your own shape
            </button>
          </div>
        </div>

        {!!selected?.starter_outline?.length && (
          <label className={styles.scaffold}>
            <input
              type="checkbox"
              checked={props.scaffold}
              onChange={(e) => props.onScaffold(e.target.checked)}
            />
            <span>
              Start with an outline
              <span className={styles.scaffoldHint}>{outlineHint(selected)}</span>
            </span>
          </label>
        )}

        <div className={styles.field}>
          <label className={styles.question} htmlFor="new-story-about">
            A line about it (optional)
          </label>
          <textarea
            id="new-story-about"
            value={props.description}
            onChange={(e) => props.onDescription(e.target.value)}
            rows={2}
            className={styles.textarea}
          />
        </div>

        <SeriesFields series={series} inSeries={inSeries} onSeries={toggleSeries} />
      </div>
    </details>
  );
}

function SeriesFields({
  series,
  inSeries,
  onSeries,
}: {
  series: SeriesChoice;
  inSeries: boolean;
  onSeries: (on: boolean) => void;
}) {
  const { previous, seriesOf } = series;
  return (
    <>
      <label className={styles.scaffold}>
        <input type="checkbox" checked={inSeries} onChange={(e) => onSeries(e.target.checked)} />
        <span>
          Part of a series, or a sequel to one of my stories
          <span className={styles.scaffoldHint}>
            A series keeps its books' people, places and promises together.
          </span>
        </span>
      </label>
      {inSeries && series.candidates.length > 0 && (
        <div className={styles.field}>
          <label className={styles.question} htmlFor="sequel-of">
            A sequel to
          </label>
          <select
            id="sequel-of"
            value={series.sequelOf}
            onChange={(e) => series.setSequelOf(e.target.value)}
            className={styles.select}
          >
            <option value="">Nothing: a book of its own</option>
            {series.candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {previous && (
            <p className={styles.templateHint}>
              {seriesOf
                ? `The book after “${previous.title}” in ${seriesOf}.`
                : `“${previous.title}” and this book become a series.`}{" "}
              Its format, genre, tone, point of view and byline carry over; who carries over comes next.
            </p>
          )}
        </div>
      )}
      {inSeries && !previous && (
        <label className={styles.scaffold}>
          <input
            type="checkbox"
            checked={series.firstOfSeries}
            onChange={(e) => series.setFirstOfSeries(e.target.checked)}
          />
          <span>
            The first book of a series
            <span className={styles.scaffoldHint}>
              The series is made with it, ready to plan the books to come on its own page.
            </span>
          </span>
        </label>
      )}
      {((previous && !seriesOf) || (!previous && series.firstOfSeries)) && (
        <div className={styles.field}>
          <label className={styles.question} htmlFor="series-name">
            The series is called
          </label>
          <input
            id="series-name"
            value={series.seriesName}
            onChange={(e) => series.setSeriesName(e.target.value)}
            placeholder={previous?.title ?? (series.title.trim() || "The Lighthouse Years")}
            className={styles.input}
          />
        </div>
      )}
    </>
  );
}
