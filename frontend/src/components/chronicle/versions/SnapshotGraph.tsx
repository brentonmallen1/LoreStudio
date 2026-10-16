import type { StorySnapshot } from "../../../types";
import { relativeTime } from "../../../utils/relativeTime";
import DeltaSummaryLine from "./DeltaSummaryLine";
import { VersionActions, type SnapshotActions } from "./SnapshotCard";
import { formatAbsoluteDate, savedBy } from "./versionsModel";
import styles from "./Versions.module.css";

/** The graph view: every version on one line, the ones you saved as filled dots. */
export default function SnapshotGraph({
  snapshots,
  onRestore,
  onDelete,
  onCompare,
  onExport,
}: Omit<SnapshotActions, "onRename"> & { snapshots: StorySnapshot[] }) {
  return (
    <div className={styles.graphList}>
      {/* What the dots mean, on the page (doc 30 D8). */}
      <div className={styles.graphKey} role="group" aria-label="Key">
        <span className={styles.graphKeyItem}>
          <span className={`${styles.graphDot} ${styles.graphDotNamed}`} aria-hidden />
          Saved by you
        </span>
        <span className={styles.graphKeyItem}>
          <span className={`${styles.graphDot} ${styles.graphDotAuto}`} aria-hidden />
          Saved automatically
        </span>
      </div>
      {snapshots.map((snap, idx) => {
        const isNamed = !!snap.name;
        const byYou = snap.trigger === "manual";
        const isLast = idx === snapshots.length - 1;
        return (
          <div key={snap.id} className={styles.graphRow}>
            <div className={styles.graphLine}>
              <div className={`${styles.graphDot} ${byYou ? styles.graphDotNamed : styles.graphDotAuto}`} />
              {!isLast && (
                <div
                  className={`${styles.graphConnector} ${byYou ? styles.graphConnectorThick : styles.graphConnectorThin}`}
                />
              )}
            </div>
            <div className={`${styles.graphCard} ${isNamed ? styles.graphCardNamed : ""}`}>
              <div className={styles.graphCardHeader}>
                <span className={`${styles.snapName} ${isNamed ? styles.snapNameNamed : ""}`}>
                  {snap.name ?? relativeTime(snap.created_at)}
                </span>
                <span className={styles.savedBy}>{savedBy(snap)}</span>
              </div>
              {!isNamed && (
                <span className={styles.snapTimestamp}>{formatAbsoluteDate(snap.created_at)}</span>
              )}
              {snap.delta_summary && (
                <div className={styles.changelogSummary}>
                  <DeltaSummaryLine d={snap.delta_summary} />
                </div>
              )}
              <VersionActions
                snapshot={snap}
                onRestore={onRestore}
                onCompare={onCompare}
                onExport={onExport}
                onDelete={() => onDelete(snap)}
                menuAlign="start"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
