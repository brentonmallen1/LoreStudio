import { formatCombo, SHORTCUTS } from "../../../lib/keyboard/shortcuts";
import { keysFrom } from "../../../lib/script/guide";
import { elementLabel, type ScriptElement } from "../../../lib/script/syntax";
import styles from "./KeysCard.module.css";

/**
 * The keys from the line being written (doc 25, P3½), at the top of the status corner's card
 * in a script: what Enter, Tab and Shift-Tab do from this element, and the shortcut for each
 * element. Read from the tables the keys follow (lib/script/guide.ts).
 */
export default function KeysCard({ element, format }: { element: ScriptElement; format: string }) {
  const first = formatCombo(SHORTCUTS.scriptHeading.combo);
  const last = formatCombo(SHORTCUTS.scriptTransition.combo);
  return (
    <section className={styles.card} aria-label="Keys from this line">
      <p className={styles.head}>From a line of {elementLabel(element, format).toLowerCase()}</p>
      <dl className={styles.keys}>
        {keysFrom(element, format).map(([key, what]) => (
          <div key={key} className={styles.row}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
        <div className={styles.row}>
          <dt>
            <kbd>
              {first}–{last.slice(-1)}
            </kbd>
          </dt>
          <dd>heading, action, character, parenthetical, dialogue, transition</dd>
        </div>
      </dl>
    </section>
  );
}
