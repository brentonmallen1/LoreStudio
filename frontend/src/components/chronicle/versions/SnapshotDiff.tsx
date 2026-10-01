import { GitCompare, X } from "lucide-react";
import type { SnapshotDiff as Diff, SnapshotDiffEntity, StorySnapshot } from "../../../types";
import { formatAbsoluteDate } from "./versionsModel";
import styles from "./Versions.module.css";

function EntitySection({ label, data }: { label: string; data?: SnapshotDiffEntity }) {
  if (!data || data.added.length + data.removed.length + data.modified.length === 0) return null;
  return (
    <div className={styles.diffSection}>
      <h4 className={styles.diffSectionTitle}>{label}</h4>
      <div className={styles.diffCounts}>
        {data.added.length > 0 && <span className={styles.diffAdded}>+{data.added.length} added</span>}
        {data.removed.length > 0 && (
          <span className={styles.diffRemoved}>-{data.removed.length} removed</span>
        )}
        {data.modified.length > 0 && (
          <span className={styles.diffModified}>{data.modified.length} modified</span>
        )}
      </div>
    </div>
  );
}

/** What changed between two snapshots, A the older. */
export default function SnapshotDiff({
  diff,
  snapA,
  snapB,
  onClose,
}: {
  diff: Diff;
  snapA: StorySnapshot;
  snapB: StorySnapshot;
  onClose: () => void;
}) {
  return (
    <div className={styles.dialogOverlay}>
      <div className={`${styles.dialog} ${styles.dialogWide}`}>
        <div className={styles.dialogHeader}>
          <GitCompare size={16} />
          <h3 className={styles.dialogTitle}>Comparing versions</h3>
          <button className={styles.dialogClose} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className={styles.diffMeta}>
          <div className={styles.diffMetaSnap}>
            <span className={styles.diffLabel}>A</span>
            <span className={styles.diffSnapName}>{snapA.name ?? formatAbsoluteDate(snapA.created_at)}</span>
          </div>
          <GitCompare size={14} className={styles.diffArrow} />
          <div className={styles.diffMetaSnap}>
            <span className={styles.diffLabel}>B</span>
            <span className={styles.diffSnapName}>{snapB.name ?? formatAbsoluteDate(snapB.created_at)}</span>
          </div>
        </div>
        <div className={styles.diffSummaryRow}>
          <span className={styles.diffWordCount}>
            {diff.word_count_delta >= 0 ? "+" : ""}
            {diff.word_count_delta.toLocaleString()} words
          </span>
          <span className={styles.diffStat}>
            A: {diff.summary.a.scene_count} scenes, {diff.summary.a.word_count.toLocaleString()} words
          </span>
          <span className={styles.diffStat}>
            B: {diff.summary.b.scene_count} scenes, {diff.summary.b.word_count.toLocaleString()} words
          </span>
        </div>
        <div className={styles.diffSections}>
          <EntitySection label="Scenes" data={diff.structure_nodes} />
          <EntitySection label="Characters" data={diff.characters} />
          <EntitySection label="Plot Threads" data={diff.plot_threads} />
          <EntitySection label="Twists" data={diff.twists} />
          <EntitySection label="Locations" data={diff.locations} />
          <EntitySection label="World Systems" data={diff.world_systems} />
          <EntitySection label="Cultures" data={diff.cultures} />
          <EntitySection label="Eras" data={diff.eras} />
          <EntitySection label="Outline Items" data={diff.outline_items} />
        </div>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
