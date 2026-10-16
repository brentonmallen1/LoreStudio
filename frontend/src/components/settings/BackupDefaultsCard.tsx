import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { UserBackupDefaults } from "../../types";
import styles from "../../pages/Settings.module.css";

/**
 * Defaults applied to new stories (per-story overrides live on the Versions page).
 *
 * Its own component because it owns its own state: Settings.tsx is on the file-length
 * debt list, and a self-contained card is the cheapest honest thing to take out of it.
 */
export default function BackupDefaultsCard() {
  const [backupDefaults, setBackupDefaults] = useState<UserBackupDefaults | null>(null);

  useEffect(() => {
    api
      .getUserBackupDefaults()
      .then(setBackupDefaults)
      .catch(() => {});
  }, []);

  async function handleBackupDefaultsChange(patch: Partial<UserBackupDefaults>) {
    setBackupDefaults(await api.updateUserBackupDefaults(patch));
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupLabel}>Versions of each story</h3>
      <p className={styles.sectionHint}>
        A version is a saved copy of one story, kept in its Chronicle › Versions. These are the settings a new
        story starts with; a story changes its own under Versions › ⋯ › Automatic versions.
      </p>
      {backupDefaults ? (
        <div className={styles.backupForm}>
          <label className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.label}>Save versions automatically</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                aria-label="Save versions automatically"
                checked={backupDefaults.auto_enabled}
                onChange={(e) => handleBackupDefaultsChange({ auto_enabled: e.target.checked })}
              />
              <span className={styles.toggleTrack} />
            </label>
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.label}>How often</label>
            <select
              aria-label="How often"
              className={styles.select}
              value={backupDefaults.interval_minutes}
              onChange={(e) => handleBackupDefaultsChange({ interval_minutes: Number(e.target.value) })}
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={240}>Every 4 hours</option>
              <option value={720}>Every 12 hours</option>
              <option value={1440}>Every 24 hours</option>
            </select>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>Keep at most</label>
            <select
              aria-label="Keep at most"
              className={styles.select}
              value={backupDefaults.max_count ?? ""}
              onChange={(e) =>
                handleBackupDefaultsChange({
                  max_count: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value={48}>48 versions</option>
              <option value={96}>96 versions</option>
              <option value={200}>200 versions</option>
              <option value={500}>500 versions</option>
              <option value="">Unlimited</option>
            </select>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.label}>Delete automatic versions older than</label>
            <select
              aria-label="Delete automatic versions older than"
              className={styles.select}
              value={backupDefaults.max_age_days ?? ""}
              onChange={(e) =>
                handleBackupDefaultsChange({
                  max_age_days: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
              <option value="">Never</option>
            </select>
          </div>
        </div>
      ) : (
        <p className={styles.hint}>Loading…</p>
      )}
    </div>
  );
}
