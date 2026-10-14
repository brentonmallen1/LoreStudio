import { Check } from "lucide-react";
import { helper, type HelperId } from "../../lib/typing/helpers";
import { ways } from "../../lib/typing/show";
import styles from "./Practice.module.css";

/** One thing to try: the helper, and what to do with it here ("Give Eleanor a line"). */
export interface PracticeStep {
  id: HelperId;
  task: string;
}

/**
 * A few things to try, each ticking off as its helper does its work (doc 26, D4). On the
 * practice page beside the sandbox (P5), and in a tutorial scene's lesson card (P6).
 */
export default function Practice({
  steps,
  tried,
  title = "Try it",
  showCount = true,
}: {
  steps: PracticeStep[];
  tried: ReadonlySet<HelperId>;
  title?: string;
  /** "2 of 5 tried" beside the title; a lesson card puts it at its foot instead. */
  showCount?: boolean;
}) {
  const count = steps.filter((s) => tried.has(s.id)).length;
  return (
    <section className={styles.practice} aria-label={title}>
      <p className={styles.head}>
        {title}
        {showCount && <span className={styles.count}>{`${count} of ${steps.length} tried`}</span>}
      </p>
      <ol className={styles.steps}>
        {steps.map((s) => {
          const done = tried.has(s.id);
          return (
            <li key={s.id} className={styles.step} data-done={done || undefined} title={helper(s.id).does}>
              <span className={styles.mark} aria-label={done ? "Tried" : "Not tried yet"}>
                {done && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={styles.task}>{s.task}</span>
              <span className={styles.ways}>
                {ways(helper(s.id)).map((w) => (
                  <kbd key={w} className={styles.kbd}>
                    {w}
                  </kbd>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
