import { X } from "lucide-react";
import type { NumbersCompare } from "../../hooks/useNumbersCompare";
import { whatChanged } from "../../lib/numbers/compare";
import type { Figures } from "../../lib/numbers/figures";
import { apart, readingName, when } from "../../lib/numbers/readings";
import { serverTime } from "../../lib/serverDate";
import type { Reading } from "../../types/numbers";
import styles from "./Compare.module.css";

const named = (r: Reading) => `${r.label ?? readingName(r).toLowerCase()} (${when(r.taken_at)})`;

/** Under the header while comparing: what is compared with what, how far apart, and ✕. */
export function CompareBar({ compare }: { compare: NumbersCompare }) {
  const { from, to, choose, clock } = compare;
  if (!from) return null;
  const gap = apart(serverTime(from.taken_at), to ? serverTime(to.taken_at) : clock);
  return (
    <div className={styles.bar} role="status">
      <span>
        {to ? (
          <>
            Comparing <strong>{named(from)}</strong> with <strong>{named(to)}</strong>, {gap} apart
          </>
        ) : (
          <>
            Comparing with <strong>{named(from)}</strong>, {gap} earlier
          </>
        )}
      </span>
      <button
        type="button"
        className={styles.barClose}
        aria-label="Stop comparing"
        title="Stop comparing"
        onClick={() => choose(null)}
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}

/** What changed: the comparison in a few plain sentences, the quickest read of it. */
export function WhatChanged({ then, now }: { then: Figures; now: Figures }) {
  const said = whatChanged(then, now);
  return (
    <section className={styles.changed} aria-label="What changed">
      <h2 className={styles.changedTitle}>What changed</h2>
      {said.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
