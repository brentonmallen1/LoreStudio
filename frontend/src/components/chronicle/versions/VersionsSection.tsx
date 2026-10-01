/**
 * The Chronicle's Versions section: manual snapshots and auto backups of the story, as a
 * grouped list or a graph, with create, rename, restore, compare, export, import and the
 * backup settings (in a modal behind the toolbar's gear button).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { History, Loader2, Plus, Settings, Upload } from "lucide-react";
import { api } from "../../../api/client";
import { toast } from "../../../stores/toastStore";
import Modal from "../../common/Modal";
import PageHeader from "../../layout/PageHeader";
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
  | { type: "delete"; snapshot: StorySnapshot }
  | { type: "compare-result"; a: StorySnapshot; b: StorySnapshot; diff: Diff };

export default function VersionsSection({ storyId }: { storyId: string }) {
  const [snapshots, setSnapshots] = useState<StorySnapshot[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const closeDialog = () => setDialog({ type: "none" });

  /** Run an action and say what went wrong if it fails: these used to fail in silence. */
  async function attempt(what: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.error(`${what} failed${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
    }
  }

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const [snaps, cfg] = await Promise.all([api.listSnapshots(storyId), api.getBackupSettings(storyId)]);
      setSnapshots(snaps);
      setSettings(cfg);
    } catch {
      toast.error("The version history could not be loaded");
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
      .catch(() => toast.error("The version history could not be loaded"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  async function handleCreate(name: string) {
    setCreating(true);
    await attempt("Creating the snapshot", async () => {
      const snap = await api.createSnapshot(storyId, name || undefined);
      setSnapshots((prev) => [snap, ...prev]);
      closeDialog();
      toast.success("Snapshot created");
    });
    setCreating(false);
  }

  async function handleRestore(snapshot: StorySnapshot, safetyBackup: boolean) {
    closeDialog();
    await attempt("Restoring", async () => {
      await api.restoreSnapshot(storyId, snapshot.id, safetyBackup);
      toast.success("Story restored to this snapshot");
      void load();
    });
  }

  async function handleDelete(snapshot: StorySnapshot) {
    closeDialog();
    await attempt("Deleting the snapshot", async () => {
      await api.deleteSnapshot(storyId, snapshot.id);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshot.id));
      toast.success("Snapshot deleted");
    });
  }

  async function handleRename(snapshot: StorySnapshot, name: string) {
    await attempt("Renaming", async () => {
      const updated = await api.renameSnapshot(storyId, snapshot.id, name || null);
      setSnapshots((prev) => prev.map((s) => (s.id === snapshot.id ? updated : s)));
    });
  }

  async function handleExport(snapshot: StorySnapshot) {
    await attempt("Exporting", () => download(snapshot));
  }

  async function download(snapshot: StorySnapshot) {
    const res = await api.exportSnapshot(storyId, snapshot.id);
    if (!res.ok) throw new Error(res.statusText);
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
      toast.error(`Comparing failed${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
      closeDialog();
    }
  }

  async function handleSettingsChange(patch: Partial<BackupSettings>) {
    if (!settings) return;
    await attempt("Saving the backup settings", async () => {
      setSettings(await api.updateBackupSettings(storyId, patch));
    });
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
    await attempt("Importing", async () => {
      const res = await api.importIntoStory(storyId, file, true);
      if (!res.ok) throw new Error(res.statusText);
      toast.success("Import complete");
      void load();
    });
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
      <PageHeader
        title="Versions"
        summary={versionsSubtitle(snapshots)}
        views={[
          { id: "list", label: "List" },
          { id: "graph", label: "Graph" },
        ]}
        view={viewMode}
        onView={(id) => setViewMode(id as ViewMode)}
        primary={{ label: "Create snapshot", icon: Plus, onClick: () => setDialog({ type: "create" }) }}
        aside={
          <>
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
          </>
        }
      />

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
        // The graph has no room for the list's inline confirm, so it asks in a dialog.
        <SnapshotGraph
          snapshots={snapshots}
          {...actions}
          onDelete={(snap) => setDialog({ type: "delete", snapshot: snap })}
        />
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
      {dialog.type === "delete" && (
        <Modal
          isOpen
          onClose={closeDialog}
          title="Delete this snapshot?"
          size="sm"
          footer={
            <>
              <button className={styles.dialogCancel} onClick={closeDialog}>
                Keep it
              </button>
              <button className={styles.dialogDanger} onClick={() => void handleDelete(dialog.snapshot)}>
                Delete
              </button>
            </>
          }
        >
          <p className={styles.dialogBody}>
            {dialog.snapshot.name ? `“${dialog.snapshot.name}”` : "This snapshot"} goes for good; the story as
            it is now is not touched.
          </p>
        </Modal>
      )}
      {dialog.type === "compare-result" && (
        <SnapshotDiff diff={dialog.diff} snapA={dialog.a} snapB={dialog.b} onClose={closeDialog} />
      )}
    </div>
  );
}
