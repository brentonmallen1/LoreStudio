import { Download, GitCompare, RotateCcw, Trash2 } from "lucide-react";
import type { StorySnapshot } from "../../../types";
import { relativeTime } from "../../../utils/relativeTime";
import DeltaSummaryLine from "./DeltaSummaryLine";
import type { SnapshotActions } from "./SnapshotCard";
import { formatAbsoluteDate } from "./versionsModel";
import styles from "./Versions.module.css";

/** The graph view: every snapshot on one line, named ones as filled dots. */
export default function SnapshotGraph({
  snapshots,
  onRestore,
  onDelete,
  onCompare,
  onExport,
}: Omit<SnapshotActions, "onRename"> & { snapshots: StorySnapshot[] }) {
  return (
    <div className={styles.graphList}>
      {snapshots.map((snap, idx) => {
        const isNamed = !!snap.name;
        const isLast = idx === snapshots.length - 1;
        return (
          <div key={snap.id} className={styles.graphRow}>
            <div className={styles.graphLine}>
              <div className={`${styles.graphDot} ${isNamed ? styles.graphDotNamed : styles.graphDotAuto}`} />
              {!isLast && (
                <div
                  className={`${styles.graphConnector} ${isNamed ? styles.graphConnectorThick : styles.graphConnectorThin}`}
                />
              )}
            </div>
            <div className={`${styles.graphCard} ${isNamed ? styles.graphCardNamed : ""}`}>
              <div className={styles.graphCardHeader}>
                <span className={`${styles.snapName} ${isNamed ? styles.snapNameNamed : ""}`}>
                  {snap.name ?? relativeTime(snap.created_at)}
                </span>
                <span
                  className={`${styles.triggerBadge} ${snap.trigger === "manual" ? styles.triggerManual : styles.triggerAuto}`}
                >
                  {snap.trigger === "manual" ? "Manual" : "Auto"}
                </span>
              </div>
              {!isNamed && (
                <span className={styles.snapTimestamp}>{formatAbsoluteDate(snap.created_at)}</span>
              )}
              {snap.delta_summary && (
                <div className={styles.changelogSummary}>
                  <DeltaSummaryLine d={snap.delta_summary} />
                </div>
              )}
              <div className={styles.snapActions}>
                <button className={styles.snapBtn} onClick={() => onExport(snap)} title="Download">
                  <Download size={11} />
                </button>
                <button className={styles.snapBtn} onClick={() => onCompare(snap)} title="Compare">
                  <GitCompare size={11} />
                </button>
                <button className={styles.snapBtn} onClick={() => onRestore(snap)} title="Restore">
                  <RotateCcw size={11} />
                </button>
                <button
                  className={`${styles.snapBtn} ${styles.snapBtnDanger}`}
                  onClick={() => onDelete(snap)}
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
