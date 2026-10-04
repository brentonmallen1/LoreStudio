import { useMemo } from "react";
import type { CarryCandidate } from "../../api/series";
import { carryKey } from "../../lib/series/carry";
import { KINDS } from "../../lib/lorebook/kinds";
import styles from "./CarryOverStep.module.css";

/**
 * "Who carries over?" (series doc): everything the book before has, by kind, each ticked
 * one starting the new book where it last stood. What the series already shares is ticked
 * to begin with, and so are the threads and twists the books have left open (v1.5): the
 * question a sequel most easily drops. Nothing else is assumed.
 */

/** A promise group's heading: only what is still open is offered. */
const PROMISE_GROUPS: Record<string, string> = {
  thread: "Plot threads still open",
  twist: "Twists not yet revealed",
};
export default function CarryOverStep({
  previousTitle,
  candidates,
  chosen,
  onChange,
}: {
  previousTitle: string;
  candidates: CarryCandidate[] | null;
  chosen: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const groups = useMemo(() => {
    const out = new Map<string, CarryCandidate[]>();
    for (const c of candidates ?? []) out.set(c.lore_kind, [...(out.get(c.lore_kind) ?? []), c]);
    return [...out.entries()];
  }, [candidates]);

  function toggle(keys: string[], on: boolean) {
    const next = new Set(chosen);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  }

  if (candidates === null) return <p className={styles.quiet}>Reading “{previousTitle}”…</p>;
  if (candidates.length === 0)
    return (
      <p className={styles.quiet}>
        “{previousTitle}” has no characters, places or world yet, so the new book starts empty. You can share
        things with the series later from any book.
      </p>
    );

  return (
    <div className={styles.step}>
      <p className={styles.lead}>
        Who and what carries over from “{previousTitle}”? Each one starts the new book as it stands at the end
        of that one, and goes on changing there. Relationships come too when both people do. Threads still
        open and twists not yet revealed come ticked: the questions the books have asked and not answered.
      </p>
      {groups.map(([kind, items]) => {
        const keys = items.map(carryKey);
        const all = keys.every((k) => chosen.has(k));
        const label = PROMISE_GROUPS[kind] ?? KINDS[kind as keyof typeof KINDS]?.plural ?? kind;
        return (
          <fieldset key={kind} className={styles.group}>
            <legend className={styles.groupHead}>
              <span>{label}</span>
              <button type="button" className={styles.allBtn} onClick={() => toggle(keys, !all)}>
                {all ? "None" : "All"}
              </button>
            </legend>
            {items.map((c) => (
              <label key={carryKey(c)} className={styles.item}>
                <input
                  type="checkbox"
                  checked={chosen.has(carryKey(c))}
                  onChange={(e) => toggle([carryKey(c)], e.target.checked)}
                />
                <span className={styles.name}>{c.name}</span>
                {c.in_series && (
                  <span className={styles.badge}>{c.ref_id ? "in the series" : "from an earlier book"}</span>
                )}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
