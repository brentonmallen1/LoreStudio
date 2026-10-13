import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { helpersHere } from "../../lib/typing/context";
import type { HelperContext } from "../../lib/typing/helpers";
import { ways } from "../../lib/typing/show";
import { useTypingStore } from "../../stores/typingStore";
import type { StoryFormat } from "../../types";
import styles from "./TypeHere.module.css";

/** Rows in the card; the rest are in the guide. */
const ROWS = 6;

/**
 * "What you can type here" in the status corner's card (doc 26, P3): the helpers for where the
 * cursor is, the one for this exact spot first and the ones not yet used before the ones that
 * are, each with what to type; what it does is its tooltip, and the guide has them all.
 */
export default function TypeHere({ format, contexts }: { format: StoryFormat; contexts: HelperContext[] }) {
  const used = useTypingStore((s) => s.used);
  const rows = helpersHere(format, contexts, used).slice(0, ROWS);
  if (!rows.length) return null;
  return (
    <section className={styles.card} aria-label="What you can type here">
      <p className={styles.head}>What you can type here</p>
      <ul className={styles.rows}>
        {rows.map((h) => (
          <li key={h.id} className={styles.row} title={h.does}>
            <kbd className={styles.kbd}>{ways(h)[0]}</kbd>
            <span className={styles.label}>{h.label}</span>
            {used.has(h.id as never) && <Check size={12} className={styles.tick} aria-label="Used" />}
          </li>
        ))}
      </ul>
      <Link to="/guides/typing" className={styles.more}>
        All of them →
      </Link>
    </section>
  );
}
