import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink, Plus, Unlink } from "lucide-react";
import { seriesApi, type Series, type SeriesElement } from "../../api/series";
import PopoverMenu from "../common/PopoverMenu";
import { CANON_KINDS, kindLabel, sheetPath } from "../../lib/series/kinds";
import { refreshBookLists } from "../../lib/series/refresh";
import { bookLabel } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import ElementProgression from "./ElementProgression";
import styles from "./Series.module.css";

/**
 * The Canon (series doc): every element the series shares, by kind, with the books it is
 * in and how it changes from one to the next. Inside a book (`here`), each says whether it
 * is in this book, and one not yet in it can be brought in, starting where it last stood.
 */
export default function Canon({
  series,
  here,
  onSeries,
  focus,
}: {
  series: Series;
  here?: string;
  onSeries: (s: Series) => void;
  /** An element to open and bring into view ("Compare" on a disagreement). Read when mounted:
   * the page keys the Canon by each request, so asking again opens it again. */
  focus?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  useEffect(() => {
    if (focus)
      document.getElementById(`canon-${focus}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focus]);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  if (series.elements.length === 0)
    return (
      <p className={styles.sectionNote}>
        Nothing is shared yet. Share a character, place or part of the world from its sheet in any book (its ⋯
        menu, “Share with the series”), or choose who carries over when you start the next book.
      </p>
    );

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function act(e: SeriesElement, run: () => Promise<Series>, done?: string) {
    setBusy(e.id);
    try {
      onSeries(await run());
      if (here) await refreshBookLists(here, e.kind);
      if (done) toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  function row(e: SeriesElement) {
    const isOpen = open.has(e.id);
    const mine = here ? e.members.find((m) => m.story_id === here) : undefined;
    return (
      <li key={e.id} id={`canon-${e.id}`} className={`${styles.element} ${isOpen ? styles.elementOpen : ""}`}>
        <div className={styles.elementRow}>
          <button className={styles.elementName} onClick={() => toggle(e.id)} aria-expanded={isOpen}>
            {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            <span>{e.name}</span>
          </button>
          <span className={styles.presence} aria-label={presenceText(series, e)}>
            {series.books.map((b) => {
              const isIn = e.members.some((m) => m.story_id === b.story_id);
              return (
                <span
                  key={b.story_id}
                  title={`${bookLabel(b.position)}: ${b.title}${isIn ? "" : " (not in it)"}`}
                  className={`${styles.dot} ${isIn ? styles.dotIn : ""} ${b.story_id === here ? styles.dotHere : ""}`}
                />
              );
            })}
          </span>
          {here &&
            (mine ? (
              <Link className={styles.inBook} to={sheetPath(here, e.kind, mine.ref_id)}>
                In this book
              </Link>
            ) : (
              <button
                className={styles.textBtn}
                disabled={busy === e.id}
                onClick={() =>
                  act(e, () => seriesApi.addToBook(series.id, e.id, here), `${e.name} is in this book now`)
                }
              >
                <Plus size={12} aria-hidden />
                Add to this book
              </button>
            ))}
          <PopoverMenu
            label={`More for ${e.name}`}
            trigger={<span aria-hidden>⋯</span>}
            items={[
              ...e.members.map((m) => ({
                label: `Open in ${bookLabel(m.position)}`,
                icon: ExternalLink,
                onSelect: () => navigate(sheetPath(m.story_id, e.kind, m.ref_id)),
              })),
              {
                label: "Stop sharing with the series",
                icon: Unlink,
                danger: true,
                onSelect: () =>
                  act(
                    e,
                    () => seriesApi.unlift(series.id, e.id),
                    `${e.name} is no longer shared; every book keeps its own`,
                  ),
              },
            ]}
          />
        </div>
        {isOpen && <ElementProgression series={series} element={e} here={here} onSeries={onSeries} />}
      </li>
    );
  }

  return (
    <div className={styles.section}>
      {CANON_KINDS.map((kind) => {
        const items = series.elements.filter((e) => e.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind} className={styles.kindGroup}>
            <h3 className={styles.kindTitle}>{kindLabel(kind, true)}</h3>
            <ul className={styles.elements}>{items.map(row)}</ul>
          </div>
        );
      })}
    </div>
  );
}

function presenceText(series: Series, e: SeriesElement): string {
  const books = e.members.map((m) => bookLabel(m.position));
  return books.length === series.books.length ? "In every book" : `In ${books.join(", ")}`;
}
