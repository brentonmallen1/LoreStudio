import { legendFor, type ColourContext, type ColourMode, type Line } from "../../lib/strip/stripModel";
import { usePanelStore } from "../../stores/panelStore";
import { entityColor } from "../panel/entityColor";
import SeverityMark from "../findings/SeverityMark";
import styles from "./Strip.module.css";

/** The key to the strip, shown while the pointer is on a stop, the picker is open or Key is on, so it never sits beside the prose unasked. */
export default function StripKey({ mode, line, ctx }: { mode: ColourMode; line: Line; ctx: ColourContext }) {
  const colours = mode === "none" ? [] : legendFor(mode, line.stops, ctx);
  // The dot beside a stop: the scenes the open tab's character, place or thread is in.
  const highlight = usePanelStore((s) => s.highlight);
  return (
    <div className={styles.key} id="strip-key" role="region" aria-label="Key to the strip">
      {highlight && (
        <div className={styles.keyRow}>
          <span className={styles.keyLabel}>Marked</span>
          <span className={styles.keyItem}>
            <span
              className={styles.swatch}
              style={{ background: entityColor(highlight.kind, highlight.id) }}
            />
            Scenes with {highlight.name} (the tab open beside the page)
          </span>
        </div>
      )}
      {colours.length > 0 && (
        <div className={styles.keyRow}>
          <span className={styles.keyLabel}>{mode === "findings" ? "Findings" : "Color"}</span>
          {colours.map((c) => (
            <span key={c.label} className={styles.keyItem}>
              {c.severity ? (
                <SeverityMark severity={c.severity} label={false} size={11} className={styles.sevMark} />
              ) : (
                <span className={styles.swatch} style={{ background: c.color }} />
              )}
              {c.label}
            </span>
          ))}
        </div>
      )}
      <div className={styles.keyRow}>
        <span className={styles.keyLabel}>State</span>
        <span className={styles.keyItem}>
          <span className={`${styles.dot} ${styles.dotDashed}`} /> Planned
        </span>
        <span className={styles.keyItem}>
          <span className={`${styles.dot} ${styles.dotHollow}`} /> Draft
        </span>
        <span className={styles.keyItem}>
          <span className={styles.dot} /> Revised
        </span>
        <span className={styles.keyItem}>
          <span className={`${styles.dot} ${styles.dotRinged}`} /> Final
        </span>
        {line.hasStations && (
          <span className={styles.keyItem}>
            <span
              className={styles.station}
              style={{ "--done": 0.6, width: 14, height: 14 } as React.CSSProperties}
            />
            Chapter ring fills as scenes reach final
          </span>
        )}
      </div>
    </div>
  );
}
