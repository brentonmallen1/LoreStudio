import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { seriesApi, type Series, type SharedItem, type SharedKind } from "../../api/series";
import { sectionPath } from "../../lib/routes";
import { bookLabel, bookList } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import styles from "./SeriesPages.module.css";

const KIND: Record<SharedKind, { label: string; section: string }> = {
  compendium_entry: { label: "Research", section: "research" },
  story_asset: { label: "Image", section: "images" },
  diagram: { label: "Diagram", section: "diagrams" },
};

/**
 * Research the series shares (v1.5): each entry, image and diagram, the books that hold it,
 * and whether their copies agree. An edit in any book is every book's, so they come apart
 * only when one book was restored, or a copy was edited while kept apart; then one book's
 * copy is made every book's. A book that lost its copy can have it back.
 */
export default function SharedResearch({
  series,
  onSeries,
}: {
  series: Series;
  onSeries: (s: Series) => void;
}) {
  const [read, setRead] = useState<{ key: string; items: SharedItem[] | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `${series.id}:${JSON.stringify(series.elements.filter((e) => e.synced).map((e) => e.members))}`;
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    seriesApi.shared(series.id).then(
      (items) => live && setRead({ key: `${key}:${nonce}`, items }),
      () => live && setRead({ key: `${key}:${nonce}`, items: null }),
    );
    return () => {
      live = false;
    };
  }, [series.id, key, nonce]);
  if (!read) return <p className={styles.quiet}>Reading the books…</p>;
  if (!read.items) return <p className={styles.quiet}>The shared research could not be read.</p>;
  const items = read.items;
  const position = (storyId: string) => series.books.find((b) => b.story_id === storyId)?.position ?? 0;

  async function run(fn: () => Promise<Series>, done: string) {
    setBusy(true);
    try {
      onSeries(await fn());
      setNonce((n) => n + 1);
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0)
    return (
      <p className={styles.quiet}>
        Nothing shared yet. In any book, open a research entry, an image or a diagram and choose “Share with
        the series”: every book then has it, and an edit in one is an edit in all.
      </p>
    );

  return (
    <ul className={styles.sharedList}>
      {items.map((item) => (
        <li key={item.element_id} className={styles.sharedRow}>
          <div className={styles.sharedHead}>
            <span className={styles.ordinal}>{KIND[item.kind].label}</span>
            <span className={styles.sharedName}>{item.name}</span>
            <span className={styles.note}>
              {item.in_step ? "the same in " : "copies differ across "}
              {bookList(item.members.map((m) => m.position))}
            </span>
          </div>
          <div className={styles.sharedActions}>
            {item.members.map((m) => (
              <Link
                key={m.story_id}
                className={styles.sharedLink}
                to={sectionPath(m.story_id, "compendium", KIND[item.kind].section, m.ref_id)}
              >
                Open in {bookLabel(m.position)}
              </Link>
            ))}
            {!item.in_step &&
              item.members.map((m) => (
                <button
                  key={`use-${m.story_id}`}
                  type="button"
                  className={styles.sharedBtn}
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => seriesApi.syncFrom(series.id, item.element_id, m.story_id),
                      `Every book has ${bookLabel(m.position)}'s ${item.name} now`,
                    )
                  }
                >
                  Use {bookLabel(m.position)}'s in every book
                </button>
              ))}
            {item.missing.map((sid) => (
              <button
                key={`in-${sid}`}
                type="button"
                className={styles.sharedBtn}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => seriesApi.addToBook(series.id, item.element_id, sid),
                    `${item.name} is in ${bookLabel(position(sid))} again`,
                  )
                }
              >
                Bring into {bookLabel(position(sid))}
              </button>
            ))}
            <button
              type="button"
              className={styles.sharedBtn}
              disabled={busy}
              onClick={() =>
                void run(
                  () => seriesApi.unlift(series.id, item.element_id),
                  `${item.name} is no longer shared: every book keeps its own copy`,
                )
              }
            >
              Stop sharing
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
