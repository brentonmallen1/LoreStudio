import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CheckCircle2,
  Download,
  GitCompare,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { StorySnapshot } from "../../../types";
import { relativeTime } from "../../../utils/relativeTime";
import DeltaSummaryLine from "./DeltaSummaryLine";
import { deltaDetailEntries, formatAbsoluteDate } from "./versionsModel";
import styles from "./Versions.module.css";

/** What a snapshot row can ask the section to do. */
export interface SnapshotActions {
  onRestore: (s: StorySnapshot) => void;
  onDelete: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onRename: (s: StorySnapshot, name: string) => void;
  onExport: (s: StorySnapshot) => void;
}

/** One snapshot in the list view: name (double-click to rename), badges, actions, changelog. */
export default function SnapshotCard({
  snapshot,
  onRestore,
  onDelete,
  onCompare,
  onRename,
  onExport,
  compact = false,
}: SnapshotActions & { snapshot: StorySnapshot; compact?: boolean }) {
  const isNamed = !!snapshot.name;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(snapshot.name ?? "");
  const [pendingDelete, setPendingDelete] = useState(false);

  function commitRename() {
    onRename(snapshot, editName.trim() || "");
    setEditing(false);
  }

  return (
    <div
      className={`${styles.snapCard} ${isNamed ? styles.snapCardNamed : ""} ${compact ? styles.snapCardCompact : ""}`}
    >
      <div className={styles.snapCardHeader}>
        <div className={styles.snapCardLeft}>
          {isNamed ? (
            <CheckCircle2 size={13} className={styles.snapIconNamed} />
          ) : (
            <Circle size={11} className={styles.snapIconAuto} />
          )}
          <div className={styles.snapCardInfo}>
            {editing ? (
              <input
                className={styles.renameInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setEditName(snapshot.name ?? "");
                  }
                }}
                onBlur={commitRename}
                autoFocus
              />
            ) : (
              <span
                className={`${styles.snapName} ${isNamed ? styles.snapNameNamed : ""}`}
                onDoubleClick={() => {
                  setEditing(true);
                  setEditName(snapshot.name ?? "");
                }}
                title="Double-click to rename"
              >
                {snapshot.name ?? (
                  <span className={styles.snapNameAuto}>{relativeTime(snapshot.created_at)}</span>
                )}
              </span>
            )}
            {isNamed && (
              <span className={styles.snapTimestamp}>
                {relativeTime(snapshot.created_at)} ({formatAbsoluteDate(snapshot.created_at)})
              </span>
            )}
          </div>
        </div>
        <div className={styles.snapCardRight}>
          <span
            className={`${styles.triggerBadge} ${snapshot.trigger === "manual" ? styles.triggerManual : styles.triggerAuto}`}
          >
            {snapshot.trigger === "manual" ? "Manual" : "Auto"}
          </span>
          {snapshot.summary && (
            <span className={styles.snapWordCount} title="Word count at this snapshot">
              {snapshot.summary.word_count.toLocaleString()} words
            </span>
          )}
          <div className={styles.snapActions}>
            <button className={styles.snapBtn} onClick={() => onExport(snapshot)} title="Download snapshot">
              <Download size={12} />
            </button>
            <button
              className={styles.snapBtn}
              onClick={() => onCompare(snapshot)}
              title="Compare with another snapshot"
            >
              <GitCompare size={12} />
            </button>
            <button
              className={styles.snapBtn}
              onClick={() => onRestore(snapshot)}
              title="Restore to this version"
            >
              <RotateCcw size={12} />
            </button>
            {pendingDelete ? (
              <div className={styles.deleteConfirm}>
                <button
                  className={styles.deleteConfirmYes}
                  onClick={() => {
                    setPendingDelete(false);
                    onDelete(snapshot);
                  }}
                >
                  Delete
                </button>
                <button className={styles.deleteConfirmNo} onClick={() => setPendingDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={`${styles.snapBtn} ${styles.snapBtnDanger}`}
                onClick={() => setPendingDelete(true)}
                title="Delete snapshot"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Changelog */}
      {snapshot.delta_summary && (
        <button className={styles.changelogRow} onClick={() => setExpanded((x) => !x)}>
          <div className={styles.changelogSummary}>
            <DeltaSummaryLine d={snapshot.delta_summary} />
          </div>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {expanded && snapshot.delta_summary && (
        <div className={styles.changelogDetail}>
          {deltaDetailEntries(snapshot.delta_summary).map(([label, value]) => (
            <span key={label} className={styles.changelogDetailItem}>
              <strong>{label}:</strong> {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
