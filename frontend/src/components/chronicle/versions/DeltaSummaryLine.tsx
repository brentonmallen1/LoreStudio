import type { SnapshotDeltaSummary } from "../../../types";
import { deltaSummaryParts } from "./versionsModel";
import styles from "./Versions.module.css";

/** One line of what changed since the previous snapshot. */
export default function DeltaSummaryLine({ d }: { d: SnapshotDeltaSummary }) {
  const parts = deltaSummaryParts(d);
  if (parts.length === 0) return <span className={styles.changelogEmpty}>No recorded changes</span>;
  return <span className={styles.changelogLine}>{parts.join("  •  ")}</span>;
}
