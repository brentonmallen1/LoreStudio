import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { seriesApi, type Series, type SeriesLane, type SeriesPromises } from "../../api/series";
import { slotVar } from "../../lib/colorSlots";
import { setupType } from "../../lib/promises/setups";
import { sheetPath } from "../../lib/series/kinds";
import { roleLabel } from "../../lib/threads/roles";
import { bookLabel } from "../../stores/seriesStore";
import type { BookStep } from "../../types/promises";
import styles from "./SeriesPages.module.css";

const STATUS: Record<SeriesLane["status"], string> = {
  open: "still open",
  resolved: "closed",
  set_aside: "set aside",
  planned: "planned",
  planted: "not revealed yet",
  revealed: "revealed",
};

/** What one book does with it, in a cell: "opens it, turns it", "2 clues, revealed". */
function cell(step: BookStep, kind: SeriesLane["kind"]): string {
  if (kind === "twist") {
    const clues = step.toward + step.away;
    return (
      [clues ? `${clues} ${clues === 1 ? "clue" : "clues"}` : "", step.reveal ? "revealed" : ""]
        .filter(Boolean)
        .join(", ") || "carried"
    );
  }
  if (step.set_aside) return "set aside";
  return step.roles.length ? [...new Set(step.roles)].map(roleLabel).join(", ") : "carried";
}

/**
 * The series' tapestry (v1.5): every thread and twist the books share, a column per book,
 * each cell what that book does with it; a line runs from the first book that has it to the
 * last. A cell opens its sheet in that book; a book's name opens that book's own tapestry.
 * Below, the setups that pay off in another book.
 */
export default function SeriesTapestry({ series }: { series: Series }) {
  const [read, setRead] = useState<{ id: string; data: SeriesPromises | null } | null>(null);
  useEffect(() => {
    let live = true;
    seriesApi.promises(series.id).then(
      (data) => live && setRead({ id: series.id, data }),
      () => live && setRead({ id: series.id, data: null }),
    );
    return () => {
      live = false;
    };
  }, [series.id, series.books, series.elements]);
  const data = read?.id === series.id ? read.data : null;
  if (!read) return <p className={styles.quiet}>Reading the books…</p>;
  if (!data) return <p className={styles.quiet}>The books could not be read.</p>;

  const n = data.books.length;
  return (
    <div className={styles.stack}>
      {data.lanes.length === 0 ? (
        <p className={styles.quiet}>
          No thread or twist runs across the books yet. Carry one into the next book when you start it, or
          share it with the series from its sheet.
        </p>
      ) : (
        <div className={styles.scroll}>
          <div className={styles.grid} style={{ "--cols": n } as React.CSSProperties} role="table">
            <div className={styles.headRow} role="row">
              <span role="columnheader">Thread or twist</span>
              {data.books.map((b) => (
                <Link
                  key={b.story_id}
                  role="columnheader"
                  className={styles.bookHead}
                  to={`/stories/${b.story_id}/promises`}
                  title={`${b.title}: its own tapestry`}
                >
                  <span className={styles.ordinal}>{bookLabel(b.position)}</span>
                  <span className={styles.bookTitle}>{b.title}</span>
                </Link>
              ))}
            </div>
            {data.lanes.map((lane) => {
              const at = new Map(lane.steps.map((s) => [s.position, s]));
              const first = lane.steps[0].position;
              const last = lane.steps[lane.steps.length - 1].position;
              return (
                <div
                  key={lane.element_id}
                  className={styles.laneRow}
                  role="row"
                  style={{ "--lane": slotVar(lane.color_slot) } as React.CSSProperties}
                >
                  <span className={styles.laneName} role="rowheader">
                    <span className={lane.kind === "twist" ? styles.diamond : styles.dot} aria-hidden />
                    <span>
                      {lane.name}
                      <span className={styles.laneStatus}>{STATUS[lane.status]}</span>
                    </span>
                  </span>
                  {data.books.map((b) => {
                    const step = at.get(b.position);
                    const through = b.position > first && b.position < last;
                    return (
                      <span
                        key={b.story_id}
                        role="cell"
                        className={`${styles.cell} ${step || through ? styles.cellOn : ""}`}
                      >
                        {step ? (
                          <Link
                            className={styles.cellLink}
                            to={sheetPath(
                              b.story_id,
                              lane.kind === "thread" ? "plot_thread" : "twist",
                              step.ref_id,
                            )}
                          >
                            {cell(step, lane.kind)}
                          </Link>
                        ) : through ? (
                          <span className={styles.cellQuiet}>not in this book</span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section aria-label="Setups across the books">
        <h3 className={styles.subTitle}>Setups that pay off in another book</h3>
        {data.setups.length === 0 ? (
          <p className={styles.quiet}>
            None yet. On a book's Setups page, link a scene to one in another book: a detail planted early
            that a later book pays off.
          </p>
        ) : (
          <ul className={styles.plainList}>
            {data.setups.map((s) => {
              const t = setupType(s.link_type);
              const a = (
                <Link to={`/stories/${s.source.story_id}/write/${s.source.node_id}`}>
                  {bookLabel(s.source.position)} · {s.source.title}
                </Link>
              );
              const b = (
                <Link to={`/stories/${s.target.story_id}/write/${s.target.node_id}`}>
                  {bookLabel(s.target.position)} · {s.target.title}
                </Link>
              );
              return (
                <li key={s.id}>
                  {t.laterFirst ? b : a} {t.verb} {t.laterFirst ? a : b}
                  {s.note && <span className={styles.note}> {s.note}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
