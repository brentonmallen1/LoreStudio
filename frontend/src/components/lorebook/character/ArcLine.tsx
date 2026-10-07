import { Fragment } from "react";
import { arcLine } from "../../../lib/lorebook/whoAreThey";
import type { Character } from "../../../types";
import styles from "./WhoAreThey.module.css";

/**
 * The arc in one line (doc 20 P5): formed by → believes → wants → needs → against → learns.
 * Read only, from the sheet's own fields; a blank is shown as a blank, never asked for.
 */
export default function ArcLine({ character }: { character: Character }) {
  const steps = arcLine(character);
  if (!steps.some((s) => s.value)) return null;
  return (
    <p className={styles.arcLine} aria-label="The arc in one line">
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && (
            <span className={styles.arcArrow} aria-hidden>
              →
            </span>
          )}
          <span className={styles.arcStep}>
            <span className={styles.arcLabel}>{s.label}</span>
            <span className={s.value ? styles.arcValue : styles.arcBlank}>{s.value || "—"}</span>
          </span>
        </Fragment>
      ))}
    </p>
  );
}
