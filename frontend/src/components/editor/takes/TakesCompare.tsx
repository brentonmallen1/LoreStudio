import { useMemo, useState } from "react";
import { parseServerDate } from "../../../lib/serverDate";
import { diffTakes, paragraphsOf, type Side } from "../../../lib/takes/diff";
import { takeName } from "../../../stores/takesStore";
import type { SceneTake } from "../../../types/takes";
import styles from "./Takes.module.css";

const day = (iso: string) =>
  parseServerDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const words = (n: number) => `${n.toLocaleString()} ${n === 1 ? "word" : "words"}`;

/** The pair to start on: the take that counts, and the open take (or the next one). */
function firstPair(takes: SceneTake[]): [string, string] {
  const counting = takes.find((t) => t.counts) ?? takes[0];
  const open = takes.find((t) => t.is_open && t.id !== counting.id);
  const other = open ?? takes.find((t) => t.id !== counting.id) ?? counting;
  return counting.number < other.number ? [counting.id, other.id] : [other.id, counting.id];
}

/**
 * Two takes side by side (doc 29 D7), the words only one of them has marked: struck through on a
 * soft red in the first, on a soft green in the second, the rest plain. Side by side where there
 * is room, one above the other where there is not (the side panel). With more than two takes,
 * two lists choose which.
 */
export default function TakesCompare({
  takes,
  onUse,
  onClose,
  closeLabel = "Back to writing",
}: {
  takes: SceneTake[];
  onUse: (take: SceneTake) => void;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const [pair, setPair] = useState<[string, string]>(() => firstPair(takes));
  const find = (id: string) => takes.find((t) => t.id === id);
  const fallback = firstPair(takes);
  const a = find(pair[0]) ?? find(fallback[0])!;
  const b = find(pair[1]) ?? find(fallback[1])!;
  const diff = useMemo(
    () => diffTakes(paragraphsOf(a.content), paragraphsOf(b.content)),
    [a.content, b.content],
  );

  const pick = (side: 0 | 1) => (
    <select
      className={styles.pick}
      aria-label={side === 0 ? "The first take" : "The second take"}
      value={side === 0 ? a.id : b.id}
      onChange={(e) => setPair(side === 0 ? [e.target.value, b.id] : [a.id, e.target.value])}
    >
      {takes.map((t) => (
        <option key={t.id} value={t.id}>
          {takeName(t)}
          {t.counts ? " ✓" : ""}
        </option>
      ))}
    </select>
  );

  return (
    <section className={styles.compare} aria-label="Compare takes">
      <div className={styles.compareHead}>
        <h2 className={styles.compareTitle}>Compare takes</h2>
        {takes.length > 2 && (
          <span className={styles.pickRow}>
            {pick(0)} with {pick(1)}
          </span>
        )}
        <span className={styles.differs} role="status">
          {a.id === b.id
            ? "The same take on both sides"
            : diff.changes === 0
              ? "The same words in both"
              : `${diff.changes} ${diff.changes === 1 ? "place differs" : "places differ"}`}
        </span>
        {onClose && (
          <button type="button" className={styles.action} onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
      <p className={styles.hint}>
        ✓ marks the take that counts: the one in your manuscript, exports and checks. The others are kept here
        until you delete them.
      </p>
      <div className={styles.columns}>
        <Column take={a} side={diff.a} which="a" onUse={onUse} />
        <Column take={b} side={diff.b} which="b" onUse={onUse} />
      </div>
      <div className={styles.legend}>
        <span className={styles.key}>
          <span className={styles.swatch} data-only="a" aria-hidden />
          only in take {a.number}
        </span>
        <span className={styles.key}>
          <span className={styles.swatch} data-only="b" aria-hidden />
          only in take {b.number}
        </span>
        <span>Unmarked text is the same in both.</span>
      </div>
    </section>
  );
}

function Column({
  take,
  side,
  which,
  onUse,
}: {
  take: SceneTake;
  side: Side;
  which: "a" | "b";
  onUse: (take: SceneTake) => void;
}) {
  const name = takeName(take);
  return (
    <section className={styles.column} aria-label={name}>
      <div className={styles.columnHead}>
        <span className={styles.columnName}>{name}</span>
        <span className={styles.columnMeta}>
          {day(take.updated_at)} · {words(take.word_count)}
        </span>
        <span className={styles.grow} />
        {take.counts ? (
          <span className={styles.counts}>✓ The one that counts</span>
        ) : (
          <button type="button" className={styles.action} onClick={() => onUse(take)}>
            Use this take
          </button>
        )}
      </div>
      <div className={styles.prose}>
        {side.length === 0 || (side.length === 1 && side[0].length === 0) ? (
          <p className={styles.empty}>No words yet.</p>
        ) : (
          side.map((runs, i) => (
            <p key={i}>
              {runs.map((r, j) =>
                !r.only ? (
                  r.text
                ) : which === "a" ? (
                  <del key={j} className={styles.only} data-only="a">
                    {r.text}
                  </del>
                ) : (
                  <ins key={j} className={styles.only} data-only="b">
                    {r.text}
                  </ins>
                ),
              )}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
