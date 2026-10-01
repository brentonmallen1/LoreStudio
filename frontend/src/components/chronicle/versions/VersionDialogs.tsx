import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../../common/Modal";
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
    <Modal
      isOpen
      onClose={onCancel}
      size="sm"
      title={`Restore to ${snapshot.name ? `“${snapshot.name}”` : formatAbsoluteDate(snapshot.created_at)}?`}
      footer={
        <>
          <button className={styles.dialogCancel} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.dialogConfirm} onClick={() => onConfirm(safetyBackup)}>
            Restore
          </button>
        </>
      }
    >
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
    </Modal>
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
    <Modal
      isOpen
      onClose={onCancel}
      size="sm"
      title="Create snapshot"
      footer={
        <>
          <button className={styles.dialogCancel} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.dialogConfirm} onClick={() => onConfirm(name)} disabled={loading}>
            {loading ? <Loader2 size={13} className={styles.spinning} /> : null}
            Create snapshot
          </button>
        </>
      }
    >
      <p className={styles.dialogBody}>Save the story as it is now, as a checkpoint you can come back to.</p>
      <input
        className={styles.dialogInput}
        placeholder="Name (optional), e.g. Before Act 2 restructure"
        aria-label="Snapshot name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(name);
        }}
        autoFocus
      />
    </Modal>
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
    <Modal
      isOpen
      onClose={onCancel}
      title={`Compare ${snapshot.name ? `“${snapshot.name}”` : relativeTime(snapshot.created_at)} with…`}
    >
      <div className={styles.comparePickItems}>
        {snapshots
          .filter((s) => s.id !== snapshot.id)
          .map((snap) => (
            <button key={snap.id} className={styles.comparePickItem} onClick={() => onPick(snap)}>
              <span className={styles.snapName}>{snap.name ?? relativeTime(snap.created_at)}</span>
              <span className={styles.snapTimestamp}>{formatAbsoluteDate(snap.created_at)}</span>
            </button>
          ))}
      </div>
    </Modal>
  );
}
