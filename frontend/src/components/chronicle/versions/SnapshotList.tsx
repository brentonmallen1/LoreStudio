import { Circle } from "lucide-react";
import type { StorySnapshot } from "../../../types";
import SnapshotCard, { type SnapshotActions } from "./SnapshotCard";
import { groupSnapshots, type SnapshotGroup } from "./versionsModel";
import styles from "./Versions.module.css";

function SnapshotGroupSection({ group, ...actions }: SnapshotActions & { group: SnapshotGroup }) {
  return (
    <div className={styles.snapshotGroup}>
      {/* Automatic versions first: they are newer than the one you saved */}
      {group.autoBackups.length > 0 && (
        <div className={styles.autoBackupList}>
          {group.autoBackups.map((snap) => (
            <SnapshotCard key={snap.id} snapshot={snap} {...actions} compact />
          ))}
        </div>
      )}

      {/* The version you saved: older, below the automatic ones */}
      {group.anchor ? (
        <SnapshotCard snapshot={group.anchor} {...actions} />
      ) : (
        <div className={styles.ungroupedHeader}>
          <Circle size={10} className={styles.snapIconAuto} />
          <span className={styles.ungroupedLabel}>Saved automatically</span>
        </div>
      )}
    </div>
  );
}

/** The list view: versions you saved newest first, each with the automatic ones above it. */
export default function SnapshotList({
  snapshots,
  ...actions
}: SnapshotActions & { snapshots: StorySnapshot[] }) {
  return (
    <div className={styles.snapList}>
      {groupSnapshots(snapshots).map((group) => (
        <SnapshotGroupSection key={group.anchor?.id ?? "ungrouped"} group={group} {...actions} />
      ))}
    </div>
  );
}
