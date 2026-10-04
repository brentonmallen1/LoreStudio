import { Link } from "react-router-dom";
import { seriesApi } from "../../api/series";
import { slotVar } from "../../lib/colorSlots";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { sheetPath } from "../../lib/series/kinds";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import type { Promises } from "../../types/promises";
import styles from "../promises/ScenePromises.module.css";

/**
 * In a book of a series (v1.5), in This scene: the threads the books before this one left
 * open and the twists they planted and have not revealed, each a question the reader carries
 * into this book (one this book lacks is a click from being brought in); and this scene's
 * setups across books, set up in an earlier book or paid off in a later one.
 */
export default function StillOpen({
  storyId,
  nodeId,
  data,
  onChanged,
}: {
  storyId: string;
  nodeId: string;
  data: Promises;
  onChanged: () => Promise<unknown>;
}) {
  const items = data.open_from_earlier;
  const links = data.series_setups.filter((s) => s.node_id === nodeId);
  if ((items.length === 0 && links.length === 0) || !data.series_id) return null;
  const colour = (refId: string | null, kind: "thread" | "twist") =>
    slotVar(
      (kind === "thread" ? data.threads : data.twists).find((t) => t.id === refId)?.color_slot ?? undefined,
    );

  async function bringIn(elementId: string, name: string, kind: "thread" | "twist") {
    if (!data.series_id) return;
    try {
      useSeriesStore.getState().accept(await seriesApi.addToBook(data.series_id, elementId, storyId));
      if (kind === "thread") await refreshThreads(storyId);
      await onChanged();
      toast.success(`${name} is in this book now, where the books before left it`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    }
  }

  return (
    <>
      {links.length > 0 && (
        <section aria-label="Across the books" className={styles.block}>
          <h4 className={styles.heading}>Across the books</h4>
          {links.map((s) => (
            <Link
              key={s.id}
              to={`/stories/${s.other.story_id}/write/${s.other.node_id}`}
              className={styles.link}
            >
              {s.direction === "out" ? "Pays off in" : "Set up in"} {bookLabel(s.other.position)} ·{" "}
              {s.other.title}
            </Link>
          ))}
        </section>
      )}
      {items.length > 0 && (
        <section aria-label="Still open from earlier books" className={styles.block}>
          <h4 className={styles.heading}>Still open from earlier books</h4>
          {items.map((o) => (
            <div
              key={o.element_id}
              className={styles.item}
              style={{ "--lane": colour(o.ref_id, o.kind) } as React.CSSProperties}
            >
              <span className={styles.dot} aria-hidden />
              <div className={styles.itemBody}>
                {o.ref_id ? (
                  <Link
                    to={sheetPath(storyId, o.kind === "thread" ? "plot_thread" : "twist", o.ref_id)}
                    className={styles.name}
                  >
                    {o.name}
                  </Link>
                ) : (
                  <span className={styles.name}>{o.name}</span>
                )}
                <span className={styles.sub}>
                  {o.kind === "thread"
                    ? `Since ${bookLabel(o.opened_book)}; last, ${bookLabel(o.last_book)} ${o.last}`
                    : `Planted in ${bookLabel(o.opened_book)}, ${o.last}, not revealed yet`}
                </span>
                {!o.ref_id && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => void bringIn(o.element_id, o.name, o.kind)}
                  >
                    Bring it into this book
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
