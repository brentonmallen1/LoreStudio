import { parseServerDate } from "../../lib/serverDate";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { SystemStatus } from "../../types/system";
import styles from "../../pages/Settings.module.css";

interface Props {
  isAdmin: boolean;
}

/** Whole-database backup status, shown inside Settings › Backups; its schedule is Automatic work's. */
export default function DatabaseBackupCard({ isAdmin }: Props) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    api
      .systemStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function handleBackupNow() {
    setBackingUp(true);
    try {
      const backups = await api.runDbBackupNow();
      setStatus((prev) => (prev ? { ...prev, backups } : prev));
    } catch {
      /* status stays as it was */
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupLabel}>Database backup</h3>
      <p className={styles.sectionHint}>
        A copy of the whole database, independent of story snapshots, on the schedule set under{" "}
        <a href="#automatic">Automatic work</a>. Restore by replacing the database file (see
        docs/upgrading.md).
      </p>
      {status ? (
        <div className={styles.backupForm}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Status</span>
            <span>
              {status.backups.enabled
                ? `Every ${status.backups.every_hours ?? 24} h · keeping ${status.backups.keep} · ${status.backups.count} on disk`
                : `Off (Automatic work) · ${status.backups.count} on disk`}
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Latest</span>
            <span>
              {status.backups.latest
                ? `${parseServerDate(status.backups.latest.created_at).toLocaleString()} · ${(
                    status.backups.latest.size_bytes /
                    (1024 * 1024)
                  ).toFixed(1)} MB`
                : "No backup yet"}
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Location</span>
            <span>{status.backups.path}</span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Schema</span>
            <span>
              v{status.version} · migration {status.database.revision ?? "none"} · foreign keys{" "}
              {status.database.foreign_keys ? "on" : "off"}
            </span>
          </div>
          {isAdmin && (
            <div className={styles.cardFooter}>
              <button className={styles.saveBtn} onClick={handleBackupNow} disabled={backingUp}>
                {backingUp ? "Backing up…" : "Back up now"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className={styles.hint}>Status unavailable</p>
      )}
    </div>
  );
}
