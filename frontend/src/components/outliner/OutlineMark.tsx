import { stopShape } from "../../lib/strip/stripModel";
import { STATUS_WORDS } from "../../lib/outline/status";
import styles from "./Outline.module.css";

/** A scene's status as the strip draws it: planned dashed, draft hollow, revised filled,
 *  final ringed, in its status colour (`lib/outline/status` says which). */
export default function OutlineMark({ status }: { status: string }) {
  return (
    <span className={styles.markSlot} role="img" aria-label={STATUS_WORDS[status] ?? status}>
      <span className={styles.mark} data-shape={stopShape(status)} data-status={status} />
    </span>
  );
}
