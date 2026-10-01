import { useState } from "react";
import { AlertCircle, History, Loader2, X } from "lucide-react";
import type { StorySnapshot } from "../../../types";
import { relativeTime } from "../../../utils/relativeTime";
import DeltaSummaryLine from "./DeltaSummaryLine";
import { formatAbsoluteDate } from "./versionsModel";
import styles from "./Versions.module.css";

/** Confirm a restore, with the option to back up the current state first. */
export function RestoreDialog({
  snapshot,
  onConfirm,
  onCancel,
}: {
  snapshot: StorySnapshot;
  onConfirm: (safetyBackup: boolean) => void;
  onCancel: () => void;
}) {
  const [safetyBackup, setSafetyBackup] = useState(true);
  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <AlertCircle size={16} className={styles.dialogWarnIcon} />
          <h3 className={styles.dialogTitle}>
            Restore to {snapshot.name ? `"${snapshot.name}"` : formatAbsoluteDate(snapshot.created_at)}?
          </h3>
        </div>
        <p className={styles.dialogBody}>
          This will revert your story to how it was on {formatAbsoluteDate(snapshot.created_at)}.
        </p>
        {snapshot.delta_summary && (
          <div className={styles.dialogChangelog}>
            <DeltaSummaryLine d={snapshot.delta_summary} />
          </div>
        )}
        <label className={styles.dialogCheckbox}>
          <input type="checkbox" checked={safetyBackup} onChange={(e) => setSafetyBackup(e.target.checked)} />
          <span>Create a backup of current state first</span>
        </label>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.dialogConfirm} onClick={() => onConfirm(safetyBackup)}>
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

/** Name and save the current story state. */
export function CreateSnapshotDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <History size={16} />
          <h3 className={styles.dialogTitle}>Create Snapshot</h3>
          <button className={styles.dialogClose} onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
        <p className={styles.dialogBody}>Save the current story state as a named checkpoint.</p>
        <input
          className={styles.dialogInput}
          placeholder='Name (optional) e.g. "Before Act 2 restructure"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name);
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.dialogConfirm} onClick={() => onConfirm(name)} disabled={loading}>
            {loading ? <Loader2 size={13} className={styles.spinning} /> : null}
            Create Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pick the second snapshot of a comparison: a banner below the list and a picker over the page. */
export function ComparePicker({
  snapshot,
  snapshots,
  onPick,
  onCancel,
}: {
  snapshot: StorySnapshot;
  snapshots: StorySnapshot[];
  onPick: (target: StorySnapshot) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className={styles.comparePickBanner}>
        <span>
          Select another snapshot to compare with{" "}
          <strong>{snapshot.name ?? relativeTime(snapshot.created_at)}</strong>
        </span>
        <button className={styles.comparePickCancel} onClick={onCancel}>
          <X size={14} />
        </button>
      </div>
      <div className={styles.comparePickOverlay}>
        <div className={styles.comparePickList}>
          <div className={styles.comparePickHeader}>
            <span>Select a snapshot to compare</span>
            <button onClick={onCancel}>
              <X size={14} />
            </button>
          </div>
          {snapshots
            .filter((s) => s.id !== snapshot.id)
            .map((snap) => (
              <button key={snap.id} className={styles.comparePickItem} onClick={() => onPick(snap)}>
                <span className={styles.snapName}>{snap.name ?? relativeTime(snap.created_at)}</span>
                <span className={styles.snapTimestamp}>{formatAbsoluteDate(snap.created_at)}</span>
              </button>
            ))}
        </div>
      </div>
    </>
  );
}
