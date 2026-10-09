import { useEffect, useState } from "react";
import { api } from "../api/client";
import { MUTATION_EVENT, type MutationEventDetail } from "../api/request";
import type { BackupStatus } from "../types";

/**
 * The open story's backup status (doc 24 D7, moved out of the header): fetched on open,
 * every minute after (which also keeps "2 hours ago" current), and at once when a snapshot
 * is written, so a backup made now shows now.
 */
export function useBackupStatus(storyId: string | undefined): BackupStatus | null {
  const [status, setStatus] = useState<{ storyId: string; value: BackupStatus } | null>(null);
  useEffect(() => {
    if (!storyId) return;
    const load = () =>
      api
        .getBackupStatus(storyId)
        .then((value) => setStatus({ storyId, value }))
        .catch(() => {});
    load();
    const interval = setInterval(load, 60_000);
    const onMutation = (e: Event) => {
      const path = (e as CustomEvent<MutationEventDetail>).detail?.path ?? "";
      if (path.includes("/snapshots")) load();
    };
    window.addEventListener(MUTATION_EVENT, onMutation);
    return () => {
      clearInterval(interval);
      window.removeEventListener(MUTATION_EVENT, onMutation);
    };
  }, [storyId]);
  return status && status.storyId === storyId ? status.value : null;
}

/** A backup that has been made and is now overdue: the one state worth a mark on the logo. */
export function backupNeedsEye(status: BackupStatus | null): boolean {
  return !!status?.last_backup_at && status.staleness === "overdue";
}
