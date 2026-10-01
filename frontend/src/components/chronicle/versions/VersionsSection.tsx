/**
 * The Chronicle's Versions section: manual snapshots and auto backups of the story, as a
 * grouped list or a graph, with create, rename, restore, compare, export, import and the
 * backup settings (in a modal behind the toolbar's gear button).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { GitBranch, History, List, Loader2, Plus, Settings, Upload } from "lucide-react";
import { api } from "../../../api/client";
import type { BackupSettings, SnapshotDiff as Diff, StorySnapshot } from "../../../types";
import BackupSettingsDialog from "./BackupSettingsDialog";
import SnapshotDiff from "./SnapshotDiff";
import SnapshotGraph from "./SnapshotGraph";
import SnapshotList from "./SnapshotList";
import { ComparePicker, CreateSnapshotDialog, RestoreDialog } from "./VersionDialogs";
import { filenameFromDisposition, orderByAge, versionsSubtitle } from "./versionsModel";
import styles from "./Versions.module.css";

type ViewMode = "list" | "graph";
type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "restore"; snapshot: StorySnapshot }
  | { type: "compare-pick"; snapshot: StorySnapshot }
  | { type: "compare-result"; a: StorySnapshot; b: StorySnapshot; diff: Diff };

export default function VersionsSection({ storyId }: { storyId: string }) {
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

  const closeDialog = () => setDialog({ type: "none" });

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
    // First load inline (not via load) so nothing sets state synchronously in the effect body.
    let cancelled = false;
    Promise.all([api.listSnapshots(storyId), api.getBackupSettings(storyId)])
      .then(([snaps, cfg]) => {
        if (cancelled) return;
        setSnapshots(snaps);
        setSettings(cfg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  async function handleCreate(name: string) {
    setCreating(true);
    try {
      const snap = await api.createSnapshot(storyId, name || undefined);
      setSnapshots((prev) => [snap, ...prev]);
      closeDialog();
      showToast("Snapshot created");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(snapshot: StorySnapshot, safetyBackup: boolean) {
    closeDialog();
    try {
      await api.restoreSnapshot(storyId, snapshot.id, safetyBackup);
      showToast("Story restored to this snapshot");
      load();
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Restore failed");
    }
  }

  async function handleDelete(snapshot: StorySnapshot) {
    await api.deleteSnapshot(storyId, snapshot.id);
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshot.id));
    showToast("Snapshot deleted");
  }

  async function handleRename(snapshot: StorySnapshot, name: string) {
    const updated = await api.renameSnapshot(storyId, snapshot.id, name || null);
    setSnapshots((prev) => prev.map((s) => (s.id === snapshot.id ? updated : s)));
  }

  async function handleExport(snapshot: StorySnapshot) {
    const res = await api.exportSnapshot(storyId, snapshot.id);
    if (!res.ok) {
      showToast("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFromDisposition(res.headers.get("Content-Disposition"));
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleComparePick(source: StorySnapshot, target: StorySnapshot) {
    try {
      const [older, newer] = orderByAge(source, target);
      const diff = await api.diffSnapshots(storyId, older.id, newer.id);
      setDialog({ type: "compare-result", a: older, b: newer, diff });
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Compare failed");
      closeDialog();
    }
  }

  async function handleSettingsChange(patch: Partial<BackupSettings>) {
    if (!settings) return;
    const updated = await api.updateBackupSettings(storyId, patch);
    setSettings(updated);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPendingImportFile(file);
  }

  async function doImport() {
    if (!pendingImportFile) return;
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

  const actions = {
    onRestore: (s: StorySnapshot) => setDialog({ type: "restore", snapshot: s }),
    onDelete: handleDelete,
    onCompare: (s: StorySnapshot) => setDialog({ type: "compare-pick", snapshot: s }),
    onRename: handleRename,
    onExport: handleExport,
  };

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <History size={18} className={styles.pageHeaderIcon} />
          <div>
            <h1 className={styles.pageTitle}>Version History</h1>
            <p className={styles.pageSubtitle}>{versionsSubtitle(snapshots)}</p>
          </div>
        </div>
        <div className={styles.pageHeaderRight}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
            >
              <List size={14} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === "graph" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("graph")}
              title="Graph view"
              aria-label="Graph view"
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
            onClick={() => setSettingsOpen(true)}
            title="Backup settings"
            aria-label="Backup settings"
            disabled={!settings}
          >
            <Settings size={14} />
          </button>
          <button className={styles.createBtn} onClick={() => setDialog({ type: "create" })}>
            <Plus size={14} /> Create Snapshot
          </button>
        </div>
      </div>

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

      {settings && (
        <BackupSettingsDialog
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onChange={handleSettingsChange}
        />
      )}

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
        <SnapshotList snapshots={snapshots} {...actions} />
      ) : (
        <SnapshotGraph snapshots={snapshots} {...actions} />
      )}

      {dialog.type === "compare-pick" && (
        <ComparePicker
          snapshot={dialog.snapshot}
          snapshots={snapshots}
          onPick={(target) => handleComparePick(dialog.snapshot, target)}
          onCancel={closeDialog}
        />
      )}
      {dialog.type === "create" && (
        <CreateSnapshotDialog onConfirm={handleCreate} onCancel={closeDialog} loading={creating} />
      )}
      {dialog.type === "restore" && (
        <RestoreDialog
          snapshot={dialog.snapshot}
          onConfirm={(safety) => handleRestore(dialog.snapshot, safety)}
          onCancel={closeDialog}
        />
      )}
      {dialog.type === "compare-result" && (
        <SnapshotDiff diff={dialog.diff} snapA={dialog.a} snapB={dialog.b} onClose={closeDialog} />
      )}
    </div>
  );
}
