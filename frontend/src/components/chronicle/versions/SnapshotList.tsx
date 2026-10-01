import { Circle } from "lucide-react";
import type { StorySnapshot } from "../../../types";
import SnapshotCard, { type SnapshotActions } from "./SnapshotCard";
import { groupSnapshots, type SnapshotGroup } from "./versionsModel";
import styles from "./Versions.module.css";

function SnapshotGroupSection({ group, ...actions }: SnapshotActions & { group: SnapshotGroup }) {
  return (
    <div className={styles.snapshotGroup}>
      {/* Auto backups first — they're newer than the anchor */}
      {group.autoBackups.length > 0 && (
        <div className={styles.autoBackupList}>
          {group.autoBackups.map((snap) => (
            <SnapshotCard key={snap.id} snapshot={snap} {...actions} compact />
          ))}
        </div>
      )}

      {/* Anchor snapshot — older, sits below its backups */}
      {group.anchor ? (
        <SnapshotCard snapshot={group.anchor} {...actions} />
      ) : (
        <div className={styles.ungroupedHeader}>
          <Circle size={10} className={styles.snapIconAuto} />
          <span className={styles.ungroupedLabel}>Before first snapshot</span>
        </div>
      )}
    </div>
  );
}

/** The list view: manual snapshots newest first, each with its auto backups above it. */
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
