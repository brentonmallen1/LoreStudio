import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { seriesApi, type ArcBeat, type Series } from "../../../api/series";
import { bookLabel } from "../../../stores/seriesStore";
import { toast } from "../../../stores/toastStore";
import styles from "./SeriesPlan.module.css";

type Draft = Omit<ArcBeat, "id"> & { id?: string; key: string };

const draftOf = (arc: ArcBeat[]): Draft[] => arc.map((b) => ({ ...b, key: b.id }));

/**
 * The arc across the books: the series' turning points in order, each with the books that
 * carry it. A beat saves when its name is left; the books are chips under it. A new beat can
 * be placed on books once it has a name.
 */
export default function ArcStep({ series, onSeries }: { series: Series; onSeries: (s: Series) => void }) {
  const [beats, setBeats] = useState<Draft[]>(() => draftOf(series.arc ?? []));

  async function save(next: Draft[]) {
    const named = next.filter((b) => b.name.trim());
    const same = (series.arc ?? []).map(({ id, name, description }) => ({ id, name, description }));
    const now = named.map(({ id, name, description }) => ({ id, name: name.trim(), description }));
    if (JSON.stringify(same) === JSON.stringify(now)) return;
    try {
      const out = await seriesApi.setArc(
        series.id,
        named.map(({ id, name, description }) => ({ id, name: name.trim(), description })),
      );
      onSeries(out);
      // New beats have their ids now; unnamed drafts stay where they were.
      let i = 0;
      setBeats(next.map((b) => (b.name.trim() ? { ...out.arc![i++], key: b.key } : b)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The arc could not be saved.");
    }
  }

  const edit = (key: string, patch: Partial<Draft>) =>
    setBeats((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const move = (i: number, to: number) => {
    const next = [...beats];
    const [b] = next.splice(i, 1);
    next.splice(to, 0, b);
    setBeats(next);
    void save(next);
  };

  function toggleBook(beatId: string, storyId: string) {
    const book = series.books.find((b) => b.story_id === storyId);
    if (!book) return;
    const has = (book.arc_beats ?? []).includes(beatId);
    const ids = (series.arc ?? []).map((b) => b.id);
    const next = has
      ? (book.arc_beats ?? []).filter((b) => b !== beatId)
      : [...(book.arc_beats ?? []), beatId];
    seriesApi
      .updateBook(series.id, storyId, { arc_beats: ids.filter((id) => next.includes(id)) })
      .then(onSeries)
      .catch((err) => toast.error(err instanceof Error ? err.message : "The arc could not be saved."));
  }

  return (
    <div className={styles.stack}>
      {beats.map((beat, i) => (
        <div key={beat.key} className={styles.beat}>
          <div className={styles.beatHead}>
            <span className={styles.beatNum}>{i + 1}</span>
            <input
              className={styles.input}
              value={beat.name}
              onChange={(e) => edit(beat.key, { name: e.target.value })}
              onBlur={() => save(beats)}
              placeholder="A turning point of the series…"
              aria-label={`Beat ${i + 1}`}
            />
            <button
              className={styles.iconBtn}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
              aria-label="Earlier in the arc"
            >
              <ArrowUp size={14} />
            </button>
            <button
              className={styles.iconBtn}
              disabled={i === beats.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label="Later in the arc"
            >
              <ArrowDown size={14} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => {
                const next = beats.filter((b) => b.key !== beat.key);
                setBeats(next);
                void save(next);
              }}
              aria-label={`Take “${beat.name || "this beat"}” out of the arc`}
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            className={styles.textarea}
            rows={2}
            value={beat.description}
            onChange={(e) => edit(beat.key, { description: e.target.value })}
            onBlur={() => save(beats)}
            placeholder="What happens, and what it changes for the books after…"
            aria-label={`What happens at beat ${i + 1}`}
          />
          {beat.id && series.books.length > 0 && (
            <div className={styles.chips} role="group" aria-label={`Books that carry ${beat.name}`}>
              {series.books.map((b) => {
                const on = (b.arc_beats ?? []).includes(beat.id!);
                return (
                  <button
                    key={b.story_id}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                    aria-pressed={on}
                    title={b.title}
                    onClick={() => toggleBook(beat.id!, b.story_id)}
                  >
                    {bookLabel(b.position)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div>
        <button
          className={styles.btn}
          onClick={() => setBeats((bs) => [...bs, { name: "", description: "", key: crypto.randomUUID() }])}
        >
          <Plus size={13} aria-hidden />
          Add a beat
        </button>
      </div>
      {series.books.length === 0 && beats.length > 0 && (
        <p className={styles.note}>Add the books, and each beat can be placed on the ones that carry it.</p>
      )}
    </div>
  );
}
