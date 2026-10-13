import { Check } from "lucide-react";
import { HELPERS, type TypingHelper } from "../../lib/typing/helpers";
import { GROUP_ORDER, GROUP_TITLES, ways, whereNote } from "../../lib/typing/show";
import { useTypingStore } from "../../stores/typingStore";
import styles from "./TypingGuide.module.css";

/**
 * The Typing guide's list (doc 26, P2), drawn from `lib/typing/helpers.ts` so it never falls
 * behind the editor: each helper with what to type, what it does and where it works, grouped
 * by what you are doing, and a tick on the ones you have used.
 */
export default function TypingGuide() {
  const used = useTypingStore((s) => s.used);
  const all = HELPERS as readonly TypingHelper[];
  const tried = all.filter((h) => used.has(h.id as never)).length;
  return (
    <div className={styles.guide}>
      <p className={styles.count}>
        {tried === 0
          ? "None used yet: each gets a tick the first time you use it."
          : `${tried} of ${all.length} used.`}
      </p>
      {GROUP_ORDER.map((group) => {
        const rows = all.filter((h) => h.group === group);
        return (
          <section key={group} className={styles.group} aria-labelledby={`typing-${group}`}>
            <h2 id={`typing-${group}`} className={styles.groupTitle}>
              {GROUP_TITLES[group]}
            </h2>
            <ul className={styles.rows}>
              {rows.map((h) => {
                const done = used.has(h.id as never);
                const where = whereNote(h);
                return (
                  <li key={h.id} className={styles.row} data-used={done || undefined}>
                    <span className={styles.ways}>
                      {ways(h).map((w, i) => (
                        <span key={w}>
                          {i > 0 && <span className={styles.or}>or</span>}
                          <kbd className={styles.kbd}>{w}</kbd>
                        </span>
                      ))}
                    </span>
                    <span className={styles.what}>
                      <strong className={styles.label}>{h.label}</strong>
                      {where && <span className={styles.where}>{where}</span>}
                      <span className={styles.does}>{h.does}</span>
                    </span>
                    <span className={styles.tick} aria-label={done ? "Used" : "Not used yet"}>
                      {done && <Check size={14} aria-hidden />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
