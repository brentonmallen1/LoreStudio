import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { StoryProgress } from "../../../api/progress";
import type { Series, SeriesBook } from "../../../api/series";
import { bookLabel } from "../../../stores/seriesStore";
import { AddRowBar, ArcModal, AxisHead } from "./BoardRows";
import CarryIntoBook from "./CarryIntoBook";
import { AddBookForm, BeatChips, RoleField, SeriesField } from "./cells";
import { ShapePrompt } from "./ShapePicker";
import SlotCell from "./SlotCell";
import styles from "./SeriesPlan.module.css";

/**
 * The series' plan on one board: what the books are about together, then a column per book
 * and a row per thing planned for each (its part, each row that changes from book to book,
 * the arc beats it carries), and a last column for the next book. Each row is defined on its
 * own header, and a new one is added under the Board.
 */
export default function SeriesBoard({
  series,
  progress,
  onSeries,
}: {
  series: Series;
  progress: Record<string, StoryProgress>;
  onSeries: (s: Series) => void;
}) {
  const [arcOpen, setArcOpen] = useState(false);
  const [carrying, setCarrying] = useState<{ book: SeriesBook; from: SeriesBook } | null>(null);
  const books = series.books;
  const axes = series.axes ?? [];
  const arc = series.arc ?? [];
  const rows = 3 + axes.length;

  const row = (key: string, name: string, head: ReactNode, cell: (b: SeriesBook) => ReactNode) => (
    <div key={key} role="row" className={styles.gridRow}>
      <div role="rowheader" className={styles.rowHead} aria-label={name}>
        {head}
      </div>
      {books.map((b) => (
        <div key={b.story_id} role="cell" className={styles.cell}>
          {cell(b)}
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.stack}>
      <div className={styles.about}>
        <label className={styles.aboutField}>
          <span className={styles.rowName}>Premise</span>
          <span className={styles.rowHint}>what the books are about together</span>
          <SeriesField series={series} field="premise" onSeries={onSeries} rows={2} />
        </label>
        <label className={styles.aboutField}>
          <span className={styles.rowName}>Intent</span>
          <span className={styles.rowHint}>why it takes more than one book</span>
          <SeriesField series={series} field="intent" onSeries={onSeries} rows={2} />
        </label>
      </div>

      <div className={styles.boardScroll}>
        <div
          className={styles.grid}
          role="table"
          aria-label={`The books of ${series.name}`}
          style={{ gridTemplateColumns: `9.5rem ${books.map(() => "minmax(12rem, 1fr)").join(" ")} 12rem` }}
        >
          <div role="row" className={styles.gridRow}>
            <div
              role="columnheader"
              className={`${styles.rowHead} ${styles.corner}`}
              aria-label="What is planned"
            />
            {books.map((b, i) => {
              const words = progress[b.story_id]?.word_count ?? 0;
              return (
                <div key={b.story_id} role="columnheader" className={styles.colHead}>
                  <span className={styles.ordinal}>{bookLabel(b.position)}</span>
                  <Link to={`/stories/${b.story_id}`} className={styles.bookName}>
                    {b.title}
                  </Link>
                  <span className={styles.columnMeta}>
                    {words > 0 ? `${words.toLocaleString()} words` : "planned"}
                    {i > 0 && words === 0 && (
                      <>
                        {" · "}
                        <button
                          className={styles.textBtn}
                          onClick={() => setCarrying({ book: b, from: books[i - 1] })}
                        >
                          Bring in the cast
                        </button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
            <div
              role="columnheader"
              className={styles.addCol}
              aria-label="The next book"
              style={{ gridColumn: books.length + 2, gridRow: `1 / span ${rows}` }}
            >
              <span className={styles.rowName}>
                {books.length === 0 ? "The first book" : "The next book"}
              </span>
              <AddBookForm series={series} onSeries={onSeries} stacked />
            </div>
          </div>

          {row(
            "part",
            "Part",
            <>
              <span className={styles.rowName}>Part</span>
              <span className={styles.rowHint}>what it does that the others don't</span>
            </>,
            (b) => (
              <RoleField series={series} book={b} onSeries={onSeries} rows={3} />
            ),
          )}
          {axes.map((a) =>
            row(
              a.id,
              a.label,
              <AxisHead key={`${a.id}|${a.label}`} series={series} axis={a} onSeries={onSeries} />,
              (b) => <SlotCell series={series} book={b} axis={a} onSeries={onSeries} />,
            ),
          )}
          <div role="row" className={styles.gridRow}>
            <div role="rowheader" className={styles.rowHead} aria-label="Arc">
              <span className={styles.rowName}>Arc</span>
              <span className={styles.rowHint}>the series' turning points</span>
              <button className={styles.textBtn} onClick={() => setArcOpen(true)}>
                {arc.length ? "Edit the beats" : "Add beats"}
              </button>
            </div>
            {arc.length || books.length === 0 ? (
              books.map((b) => (
                <div key={b.story_id} role="cell" className={styles.cell}>
                  <BeatChips series={series} book={b} onSeries={onSeries} />
                </div>
              ))
            ) : (
              <div role="cell" className={styles.cell} style={{ gridColumn: `2 / span ${books.length}` }}>
                <p className={styles.note}>
                  No arc across the books yet.{" "}
                  <button className={styles.textBtn} onClick={() => setArcOpen(true)}>
                    Add its beats
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddRowBar series={series} onSeries={onSeries} />
      <ShapePrompt series={series} onSeries={onSeries} />

      <ArcModal open={arcOpen} onClose={() => setArcOpen(false)} series={series} onSeries={onSeries} />
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
