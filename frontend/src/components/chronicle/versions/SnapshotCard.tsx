import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CheckCircle2,
  Download,
  GitCompare,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import PopoverMenu, { type MenuItem } from "../../common/PopoverMenu";
import type { StorySnapshot } from "../../../types";
import { relativeTime } from "../../../utils/relativeTime";
import DeltaSummaryLine from "./DeltaSummaryLine";
import { deltaDetailEntries, formatAbsoluteDate, savedBy } from "./versionsModel";
import styles from "./Versions.module.css";

/** What a snapshot row can ask the section to do. */
export interface SnapshotActions {
  onRestore: (s: StorySnapshot) => void;
  onDelete: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onRename: (s: StorySnapshot, name: string) => void;
  onExport: (s: StorySnapshot) => void;
}

/** A version's name, or when it was saved: what its buttons are named after. */
function versionName(snapshot: StorySnapshot): string {
  return snapshot.name ? `“${snapshot.name}”` : `the version from ${relativeTime(snapshot.created_at)}`;
}

/**
 * A version's actions, in words (doc 30 D8): Restore and Compare on the card, the rest under
 * its ⋯. Nothing waits for the pointer to find it.
 */
export function VersionActions({
  snapshot,
  onRestore,
  onCompare,
  onExport,
  onRename,
  onDelete,
  menuAlign = "end",
}: {
  snapshot: StorySnapshot;
  /** Where the ⋯ menu opens from: "start" where the actions sit at the card's left. */
  menuAlign?: "start" | "end";
  onRestore: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onExport: (s: StorySnapshot) => void;
  onRename?: () => void;
  onDelete: () => void;
}) {
  const name = versionName(snapshot);
  const more: MenuItem[] = [
    ...(onRename ? [{ label: "Rename", icon: Pencil, onSelect: onRename }] : []),
    { label: "Download", icon: Download, onSelect: () => onExport(snapshot) },
    { label: "Delete", icon: Trash2, danger: true, onSelect: onDelete },
  ];
  return (
    <div className={styles.snapActions}>
      <button
        type="button"
        className={styles.snapBtn}
        onClick={() => onRestore(snapshot)}
        aria-label={`Restore ${name}`}
      >
        <RotateCcw size={12} aria-hidden />
        Restore
      </button>
      <button
        type="button"
        className={styles.snapBtn}
        onClick={() => onCompare(snapshot)}
        aria-label={`Compare ${name} with another version`}
      >
        <GitCompare size={12} aria-hidden />
        Compare
      </button>
      <PopoverMenu
        label={`More for ${name}`}
        trigger={<MoreHorizontal size={14} />}
        items={more}
        align={menuAlign}
      />
    </div>
  );
}

/** One version in the list view: its name, who saved it, its actions in words, its changelog. */
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

  function startRename() {
    setEditing(true);
    setEditName(snapshot.name ?? "");
  }

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
          {snapshot.trigger === "manual" ? (
            <CheckCircle2 size={13} className={styles.snapIconNamed} aria-hidden />
          ) : (
            <Circle size={11} className={styles.snapIconAuto} aria-hidden />
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
                onDoubleClick={startRename}
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
          <span className={styles.savedBy}>{savedBy(snapshot)}</span>
          {snapshot.summary && (
            <span className={styles.snapWordCount}>{snapshot.summary.word_count.toLocaleString()} words</span>
          )}
          {pendingDelete ? (
            <div
              className={styles.deleteConfirm}
              role="group"
              aria-label={`Delete ${versionName(snapshot)}?`}
            >
              <button
                type="button"
                className={styles.deleteConfirmYes}
                onClick={() => {
                  setPendingDelete(false);
                  onDelete(snapshot);
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className={styles.deleteConfirmNo}
                onClick={() => setPendingDelete(false)}
                autoFocus
              >
                Keep it
              </button>
            </div>
          ) : (
            <VersionActions
              snapshot={snapshot}
              onRestore={onRestore}
              onCompare={onCompare}
              onExport={onExport}
              onRename={startRename}
              onDelete={() => setPendingDelete(true)}
            />
          )}
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
