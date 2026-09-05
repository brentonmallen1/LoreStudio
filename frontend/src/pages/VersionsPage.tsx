import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  History,
  Plus,
  List,
  GitBranch,
  Settings,
  ChevronDown,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  GitCompare,
  Loader2,
  AlertCircle,
  Circle,
  CheckCircle2,
  X,
  ChevronUp,
} from "lucide-react";
import { api } from "../api/client";
import type { StorySnapshot, BackupSettings, SnapshotDiff, SnapshotDeltaSummary } from "../types";
import styles from "./VersionsPage.module.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDelta(n: number): string {
  if (n === 0) return "";
  return n > 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`;
}

function DeltaSummaryLine({ d }: { d: SnapshotDeltaSummary }) {
  const parts: string[] = [];
  if (d.scenes_added > 0) parts.push(`+${d.scenes_added} scene${d.scenes_added !== 1 ? "s" : ""}`);
  if (d.scenes_removed > 0) parts.push(`-${d.scenes_removed} scene${d.scenes_removed !== 1 ? "s" : ""}`);
  if (d.scenes_modified > 0)
    parts.push(`${d.scenes_modified} scene${d.scenes_modified !== 1 ? "s" : ""} modified`);
  if (d.characters_added > 0)
    parts.push(`+${d.characters_added} character${d.characters_added !== 1 ? "s" : ""}`);
  if (d.characters_modified > 0)
    parts.push(`${d.characters_modified} character${d.characters_modified !== 1 ? "s" : ""} modified`);
  if (d.threads_added > 0) parts.push(`+${d.threads_added} thread${d.threads_added !== 1 ? "s" : ""}`);
  const wc = formatDelta(d.word_count_delta);
  if (wc) parts.unshift(`${wc} words`);
  if (parts.length === 0) return <span className={styles.changelogEmpty}>No recorded changes</span>;
  return <span className={styles.changelogLine}>{parts.join("  •  ")}</span>;
}

// ---------------------------------------------------------------------------
// Restore confirmation dialog
// ---------------------------------------------------------------------------

function RestoreDialog({
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

// ---------------------------------------------------------------------------
// Compare modal
// ---------------------------------------------------------------------------

function CompareModal({
  diff,
  snapA,
  snapB,
  onClose,
}: {
  diff: SnapshotDiff;
  snapA: StorySnapshot;
  snapB: StorySnapshot;
  onClose: () => void;
}) {
  function EntitySection({
    label,
    data,
  }: {
    label: string;
    data?: { added: unknown[]; removed: unknown[]; modified: unknown[] };
  }) {
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

// ---------------------------------------------------------------------------
// Create snapshot dialog
// ---------------------------------------------------------------------------

function CreateSnapshotDialog({
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

// ---------------------------------------------------------------------------
// Snapshot card (list view)
// ---------------------------------------------------------------------------

function SnapshotCard({
  snapshot,
  onRestore,
  onDelete,
  onCompare,
  onRename,
  onExport,
  compact = false,
}: {
  snapshot: StorySnapshot;
  onRestore: (s: StorySnapshot) => void;
  onDelete: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onRename: (s: StorySnapshot, name: string) => void;
  onExport: (s: StorySnapshot) => void;
  compact?: boolean;
}) {
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
                {relativeTime(snapshot.created_at)} — {formatAbsoluteDate(snapshot.created_at)}
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
          {Object.entries(snapshot.delta_summary).map(([k, v]) =>
            typeof v === "number" && v !== 0 ? (
              <span key={k} className={styles.changelogDetailItem}>
                <strong>{k.replace(/_/g, " ")}:</strong> {v > 0 ? `+${v}` : v}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph view
// ---------------------------------------------------------------------------

function GraphView({
  snapshots,
  onRestore,
  onDelete,
  onCompare,
  onExport,
}: {
  snapshots: StorySnapshot[];
  onRestore: (s: StorySnapshot) => void;
  onDelete: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onExport: (s: StorySnapshot) => void;
}) {
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

// ---------------------------------------------------------------------------
// Snapshot grouping
// ---------------------------------------------------------------------------

interface SnapshotGroup {
  anchor: StorySnapshot | null; // null = ungrouped (pre-dates first snapshot)
  autoBackups: StorySnapshot[];
}

function groupSnapshots(snapshots: StorySnapshot[]): SnapshotGroup[] {
  const manuals = snapshots.filter((s) => s.trigger === "manual");
  const autos = snapshots.filter((s) => s.trigger === "auto");

  const groups: SnapshotGroup[] = manuals.map((anchor) => ({
    anchor,
    autoBackups: autos
      .filter((a) => a.base_snapshot_id === anchor.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));

  // Any auto backups whose anchor isn't in the current list (e.g., anchor deleted, or full-type auto)
  const groupedAutoIds = new Set(groups.flatMap((g) => g.autoBackups.map((a) => a.id)));
  const ungrouped = autos
    .filter((a) => !groupedAutoIds.has(a.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (ungrouped.length > 0) {
    groups.push({ anchor: null, autoBackups: ungrouped });
  }

  // Sort groups newest-first by anchor; ungrouped (null anchor) goes last
  groups.sort((a, b) => {
    if (!a.anchor) return 1;
    if (!b.anchor) return -1;
    return new Date(b.anchor.created_at).getTime() - new Date(a.anchor.created_at).getTime();
  });

  return groups;
}

function SnapshotGroupSection({
  group,
  onRestore,
  onDelete,
  onCompare,
  onRename,
  onExport,
}: {
  group: SnapshotGroup;
  onRestore: (s: StorySnapshot) => void;
  onDelete: (s: StorySnapshot) => void;
  onCompare: (s: StorySnapshot) => void;
  onRename: (s: StorySnapshot, name: string) => void;
  onExport: (s: StorySnapshot) => void;
}) {
  return (
    <div className={styles.snapshotGroup}>
      {/* Auto backups first — they're newer than the anchor */}
      {group.autoBackups.length > 0 && (
        <div className={styles.autoBackupList}>
          {group.autoBackups.map((snap) => (
            <SnapshotCard
              key={snap.id}
              snapshot={snap}
              onRestore={onRestore}
              onDelete={onDelete}
              onCompare={onCompare}
              onRename={onRename}
              onExport={onExport}
              compact
            />
          ))}
        </div>
      )}

      {/* Anchor snapshot — older, sits below its backups */}
      {group.anchor ? (
        <SnapshotCard
          snapshot={group.anchor}
          onRestore={onRestore}
          onDelete={onDelete}
          onCompare={onCompare}
          onRename={onRename}
          onExport={onExport}
        />
      ) : (
        <div className={styles.ungroupedHeader}>
          <Circle size={10} className={styles.snapIconAuto} />
          <span className={styles.ungroupedLabel}>Before first snapshot</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup settings panel
// ---------------------------------------------------------------------------

const INTERVAL_OPTIONS = [
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 240, label: "Every 4 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every 24 hours" },
];

const MAX_COUNT_OPTIONS = [
  { value: 48, label: "48 backups" },
  { value: 96, label: "96 backups" },
  { value: 200, label: "200 backups" },
  { value: 500, label: "500 backups" },
  { value: null, label: "Unlimited" },
];

const MAX_AGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Never" },
];

const LOG_LIMIT_OPTIONS = [
  { value: 100, label: "100 entries" },
  { value: 500, label: "500 entries" },
  { value: 1000, label: "1,000 entries" },
  { value: 5000, label: "5,000 entries" },
  { value: null, label: "Unlimited" },
];

function BackupSettingsPanel({
  settings,
  onChange,
}: {
  settings: BackupSettings;
  onChange: (patch: Partial<BackupSettings>) => void;
}) {
  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.auto_enabled}
            onChange={(e) => onChange({ auto_enabled: e.target.checked })}
          />
          Enable automatic backups
        </label>
      </div>

      {settings.auto_enabled && (
        <>
          <div className={styles.settingsRow}>
            <span className={styles.settingsFieldLabel}>Backup frequency</span>
            <select
              className={styles.settingsSelect}
              value={settings.interval_minutes}
              onChange={(e) => onChange({ interval_minutes: Number(e.target.value) })}
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingsRow}>
            <span className={styles.settingsFieldLabel}>Keep at most (auto backups)</span>
            <select
              className={styles.settingsSelect}
              value={settings.max_count ?? ""}
              onChange={(e) => onChange({ max_count: e.target.value ? Number(e.target.value) : null })}
            >
              {MAX_COUNT_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.settingsRow}>
            <span className={styles.settingsFieldLabel}>Delete backups older than</span>
            <select
              className={styles.settingsSelect}
              value={settings.max_age_days ?? ""}
              onChange={(e) => onChange({ max_age_days: e.target.value ? Number(e.target.value) : null })}
            >
              {MAX_AGE_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className={styles.settingsDivider} />
      <p className={styles.settingsSectionLabel}>What to include in backups</p>

      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.include_diagrams}
            onChange={(e) => onChange({ include_diagrams: e.target.checked })}
          />
          Diagrams
        </label>
      </div>
      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.include_interviews}
            onChange={(e) => onChange({ include_interviews: e.target.checked })}
          />
          Character interviews & panel sessions
        </label>
      </div>
      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.include_chat_sessions}
            onChange={(e) => onChange({ include_chat_sessions: e.target.checked })}
          />
          AI chat sessions
        </label>
      </div>
      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.include_activity_logs}
            onChange={(e) => onChange({ include_activity_logs: e.target.checked })}
          />
          Activity logs
        </label>
        {settings.include_activity_logs && (
          <div className={styles.settingsSubRow}>
            <span className={styles.settingsFieldLabel}>Keep last</span>
            <select
              className={styles.settingsSelect}
              value={settings.activity_log_limit ?? ""}
              onChange={(e) =>
                onChange({ activity_log_limit: e.target.value ? Number(e.target.value) : null })
              }
            >
              {LOG_LIMIT_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className={styles.settingsRow}>
        <label className={styles.settingsLabel}>
          <input
            type="checkbox"
            checked={settings.include_media_assets}
            onChange={(e) => onChange({ include_media_assets: e.target.checked })}
          />
          Media assets
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type ViewMode = "list" | "graph";
type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "restore"; snapshot: StorySnapshot }
  | { type: "compare-pick"; snapshot: StorySnapshot }
  | { type: "compare-result"; a: StorySnapshot; b: StorySnapshot; diff: SnapshotDiff };

export default function VersionsPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [snapshots, setSnapshots] = useState<StorySnapshot[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [toast, setToast] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const snapshotCount = snapshots.filter((s) => s.trigger === "manual").length;
  const backupCount = snapshots.filter((s) => s.trigger === "auto").length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const [snaps, cfg] = await Promise.all([api.listSnapshots(storyId), api.getBackupSettings(storyId)]);
      setSnapshots(snaps);
      setSettings(cfg);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(name: string) {
    if (!storyId) return;
    setCreating(true);
    try {
      const snap = await api.createSnapshot(storyId, name || undefined);
      setSnapshots((prev) => [snap, ...prev]);
      setDialog({ type: "none" });
      showToast("Snapshot created");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(snapshot: StorySnapshot, safetyBackup: boolean) {
    if (!storyId) return;
    setDialog({ type: "none" });
    try {
      await api.restoreSnapshot(storyId, snapshot.id, safetyBackup);
      showToast("Story restored to this snapshot");
      load();
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Restore failed");
    }
  }

  async function handleDelete(snapshot: StorySnapshot) {
    if (!storyId) return;
    await api.deleteSnapshot(storyId, snapshot.id);
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshot.id));
    showToast("Snapshot deleted");
  }

  async function handleRename(snapshot: StorySnapshot, name: string) {
    if (!storyId) return;
    const updated = await api.renameSnapshot(storyId, snapshot.id, name || null);
    setSnapshots((prev) => prev.map((s) => (s.id === snapshot.id ? updated : s)));
  }

  async function handleExport(snapshot: StorySnapshot) {
    if (!storyId) return;
    const res = await api.exportSnapshot(storyId, snapshot.id);
    if (!res.ok) {
      showToast("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="([^"]+)"/);
    a.download = match ? match[1] : "snapshot.lorestudio.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCompare(snapshot: StorySnapshot) {
    setDialog({ type: "compare-pick", snapshot });
  }

  async function handleComparePick(target: StorySnapshot) {
    if (!storyId || dialog.type !== "compare-pick") return;
    const a = dialog.snapshot;
    const b = target;
    try {
      // Ensure a is older than b
      const [older, newer] = new Date(a.created_at) < new Date(b.created_at) ? [a, b] : [b, a];
      const diff = await api.diffSnapshots(storyId, older.id, newer.id);
      setDialog({ type: "compare-result", a: older, b: newer, diff });
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Compare failed");
      setDialog({ type: "none" });
    }
  }

  async function handleSettingsChange(patch: Partial<BackupSettings>) {
    if (!storyId || !settings) return;
    const updated = await api.updateBackupSettings(storyId, patch);
    setSettings(updated);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !storyId) return;
    e.target.value = "";
    setPendingImportFile(file);
  }

  async function doImport() {
    if (!storyId || !pendingImportFile) return;
    const file = pendingImportFile;
    setPendingImportFile(null);
    const res = await api.importIntoStory(storyId, file, true);
    if (!res.ok) {
      showToast("Import failed");
      return;
    }
    showToast("Import complete");
    load();
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingRow}>
          <Loader2 size={16} className={styles.spinning} /> Loading version history…
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <History size={18} className={styles.pageHeaderIcon} />
          <div>
            <h1 className={styles.pageTitle}>Version History</h1>
            <p className={styles.pageSubtitle}>
              {snapshotCount} snapshot{snapshotCount !== 1 ? "s" : ""}
              {backupCount > 0 && ` · ${backupCount} auto backup${backupCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className={styles.pageHeaderRight}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List size={14} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === "graph" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("graph")}
              title="Graph view"
            >
              <GitBranch size={14} />
            </button>
          </div>
          <input
            type="file"
            accept=".zip,.lorestudio.zip"
            ref={importRef}
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button
            className={styles.headerBtn}
            onClick={() => importRef.current?.click()}
            title="Import from file"
          >
            <Upload size={14} /> Import
          </button>
          <button
            className={`${styles.headerBtn} ${settingsOpen ? styles.headerBtnActive : ""}`}
            onClick={() => setSettingsOpen((x) => !x)}
            title="Backup settings"
          >
            <Settings size={14} />
          </button>
          <button className={styles.createBtn} onClick={() => setDialog({ type: "create" })}>
            <Plus size={14} /> Create Snapshot
          </button>
        </div>
      </div>

      {/* Import confirmation banner */}
      {pendingImportFile && (
        <div className={styles.importConfirm}>
          <span className={styles.importConfirmText}>
            Import <strong>{pendingImportFile.name}</strong>? The current story state will be saved as a
            backup first.
          </span>
          <div className={styles.importConfirmActions}>
            <button className={styles.importConfirmYes} onClick={doImport}>
              Import
            </button>
            <button className={styles.importConfirmNo} onClick={() => setPendingImportFile(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && settings && (
        <BackupSettingsPanel settings={settings} onChange={handleSettingsChange} />
      )}

      {/* Snapshot list or graph */}
      {snapshots.length === 0 ? (
        <div className={styles.empty}>
          <History size={32} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No snapshots yet</p>
          <p className={styles.emptyHint}>
            Create a manual snapshot to start tracking your story's history. Auto backups will appear here
            once they run.
          </p>
          <button className={styles.createBtn} onClick={() => setDialog({ type: "create" })}>
            <Plus size={14} /> Create First Snapshot
          </button>
        </div>
      ) : viewMode === "list" ? (
        <div className={styles.snapList}>
          {groupSnapshots(snapshots).map((group) => (
            <SnapshotGroupSection
              key={group.anchor?.id ?? "ungrouped"}
              group={group}
              onRestore={(s) => setDialog({ type: "restore", snapshot: s })}
              onDelete={handleDelete}
              onCompare={handleCompare}
              onRename={handleRename}
              onExport={handleExport}
            />
          ))}
        </div>
      ) : (
        <GraphView
          snapshots={snapshots}
          onRestore={(s) => setDialog({ type: "restore", snapshot: s })}
          onDelete={handleDelete}
          onCompare={handleCompare}
          onExport={handleExport}
        />
      )}

      {/* Compare-pick mode: highlight selectable snapshots */}
      {dialog.type === "compare-pick" && (
        <div className={styles.comparePickBanner}>
          <span>
            Select another snapshot to compare with{" "}
            <strong>{dialog.snapshot.name ?? relativeTime(dialog.snapshot.created_at)}</strong>
          </span>
          <button className={styles.comparePickCancel} onClick={() => setDialog({ type: "none" })}>
            <X size={14} />
          </button>
        </div>
      )}

      {dialog.type === "compare-pick" && (
        <div className={styles.comparePickOverlay}>
          <div className={styles.comparePickList}>
            <div className={styles.comparePickHeader}>
              <span>Select a snapshot to compare</span>
              <button onClick={() => setDialog({ type: "none" })}>
                <X size={14} />
              </button>
            </div>
            {snapshots
              .filter(
                (s) => s.id !== (dialog as { type: "compare-pick"; snapshot: StorySnapshot }).snapshot.id,
              )
              .map((snap) => (
                <button
                  key={snap.id}
                  className={styles.comparePickItem}
                  onClick={() => handleComparePick(snap)}
                >
                  <span className={styles.snapName}>{snap.name ?? relativeTime(snap.created_at)}</span>
                  <span className={styles.snapTimestamp}>{formatAbsoluteDate(snap.created_at)}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {dialog.type === "create" && (
        <CreateSnapshotDialog
          onConfirm={handleCreate}
          onCancel={() => setDialog({ type: "none" })}
          loading={creating}
        />
      )}
      {dialog.type === "restore" && (
        <RestoreDialog
          snapshot={dialog.snapshot}
          onConfirm={(safety) => handleRestore(dialog.snapshot, safety)}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "compare-result" && (
        <CompareModal
          diff={dialog.diff}
          snapA={dialog.a}
          snapB={dialog.b}
          onClose={() => setDialog({ type: "none" })}
        />
      )}
    </div>
  );
}
