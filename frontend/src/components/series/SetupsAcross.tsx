import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../../api/client";
import { seriesApi } from "../../api/series";
import { SETUP_TYPES, setupType } from "../../lib/promises/setups";
import { bookLabel, useSeriesStore } from "../../stores/seriesStore";
import { toast } from "../../stores/toastStore";
import type { PromiseScene, Promises, SeriesSetup } from "../../types/promises";
import styles from "../promises/Promises.module.css";

/** "One Year On calls back to Book 1 · The New Entry", earlier scene first unless the type reads back. */
function sentence(s: SeriesSetup, here: string) {
  const t = setupType(s.link_type);
  const there = `${bookLabel(s.other.position)} · ${s.other.title}`;
  const [earlier, later] = s.direction === "out" ? [here, there] : [there, here];
  return t.laterFirst ? `${later} ${t.verb} ${earlier}` : `${earlier} ${t.verb} ${later}`;
}

/**
 * Setups across books (v1.5), on the Setups page of a book of a series: a scene here that a
 * later book pays off, or one that pays off what an earlier book set up. Made from either end;
 * undone in the book it was made in.
 */
export default function SetupsAcross({
  storyId,
  data,
  reload,
}: {
  storyId: string;
  data: Promises;
  reload: () => Promise<unknown>;
}) {
  const series = useSeriesStore((s) => s.series);
  const [here, setHere] = useState("");
  const [type, setType] = useState("foreshadowing");
  const [book, setBook] = useState("");
  const [there, setThere] = useState("");
  const [note, setNote] = useState("");
  const [read, setRead] = useState<{ book: string; scenes: PromiseScene[] } | null>(null);
  // The other book's scenes, read when it is chosen.
  useEffect(() => {
    if (!book) return;
    let live = true;
    api.getPromises(book).then(
      (d) => live && setRead({ book, scenes: d.scenes }),
      () => live && setRead({ book, scenes: [] }),
    );
    return () => {
      live = false;
    };
  }, [book]);
  if (!series || !data.series_id || series.books.length < 2) return null;
  const others = series.books.filter((b) => b.story_id !== storyId);
  const theirs = read?.book === book ? read.scenes : [];
  const title = (id: string) => data.scenes.find((s) => s.id === id)?.title ?? "a scene";

  async function add() {
    if (!series) return;
    try {
      await seriesApi.addLink(series.id, {
        story_id: storyId,
        node_id: here,
        other_story_id: book,
        other_node_id: there,
        link_type: type,
        note,
      });
      setHere("");
      setThere("");
      setNote("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link those scenes");
    }
  }

  async function remove(id: string) {
    if (!series) return;
    try {
      await seriesApi.removeLink(series.id, id);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that link");
    }
  }

  return (
    <section className={styles.card} aria-label="Across the books">
      <h2 className={styles.cardTitle}>Across the books of {series.name}</h2>
      {data.series_setups.length === 0 ? (
        <p className={styles.quiet}>
          Nothing set up here pays off in another book yet, and nothing from another book pays off here.
        </p>
      ) : (
        <div className={styles.list}>
          {data.series_setups.map((s) => (
            <div key={s.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  <span className={styles.tag} title={setupType(s.link_type).hint}>
                    {s.direction === "out" ? "Pays off later" : "Set up earlier"}
                  </span>{" "}
                  {sentence(s, title(s.node_id))}
                </span>
                {s.note && <span className={styles.rowNote}>{s.note}</span>}
                <Link className={styles.rowNote} to={`/stories/${s.other.story_id}/write/${s.other.node_id}`}>
                  Open it in {bookLabel(s.other.position)}
                </Link>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Remove: ${sentence(s, title(s.node_id))}`}
                title="Remove this link"
                onClick={() => void remove(s.id)}
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.form}>
        <select aria-label="The scene in this book" value={here} onChange={(e) => setHere(e.target.value)}>
          <option value="">A scene here…</option>
          {data.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select aria-label="How they are linked" value={type} onChange={(e) => setType(e.target.value)}>
          {SETUP_TYPES.map((t) => (
            <option key={t.value} value={t.value} title={t.hint}>
              {t.label.toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="The other book"
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setThere("");
          }}
        >
          <option value="">…a scene in another book</option>
          {others.map((b) => (
            <option key={b.story_id} value={b.story_id}>
              {bookLabel(b.position)}: {b.title}
            </option>
          ))}
        </select>
        {book && (
          <select
            aria-label="The scene in that book"
            value={there}
            onChange={(e) => setThere(e.target.value)}
          >
            <option value="">Which scene?</option>
            {theirs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
        <input
          aria-label="What links them"
          placeholder="What links them (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!here || !book || !there}
          onClick={() => void add()}
        >
          Link them
        </button>
      </div>
    </section>
  );
}
