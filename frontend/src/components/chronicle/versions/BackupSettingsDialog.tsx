import { Settings } from "lucide-react";
import Modal from "../../common/Modal";
import type { BackupSettings } from "../../../types";
import { INTERVAL_OPTIONS, LOG_LIMIT_OPTIONS, MAX_AGE_OPTIONS, MAX_COUNT_OPTIONS } from "./versionsModel";
import styles from "./Versions.module.css";

type Patch = Partial<BackupSettings>;

/** A select over a nullable number, where "" stands for null. */
function NullableSelect({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: { value: number | null; label: string }[];
  onChange: (value: number | null) => void;
}) {
  return (
    <select
      className={styles.settingsSelect}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value ?? ""}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function IncludeToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.settingsLabel}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Automatic backup schedule, retention and contents. Every change saves at once. */
export default function BackupSettingsDialog({
  isOpen,
  onClose,
  settings,
  onChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: BackupSettings;
  onChange: (patch: Patch) => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backup settings" icon={<Settings size={16} />} size="md">
      <div className={styles.settingsPanel}>
        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.auto_enabled}
            label="Enable automatic backups"
            onChange={(v) => onChange({ auto_enabled: v })}
          />
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
              <NullableSelect
                value={settings.max_count}
                options={MAX_COUNT_OPTIONS}
                onChange={(v) => onChange({ max_count: v })}
              />
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsFieldLabel}>Delete backups older than</span>
              <NullableSelect
                value={settings.max_age_days}
                options={MAX_AGE_OPTIONS}
                onChange={(v) => onChange({ max_age_days: v })}
              />
            </div>
          </>
        )}

        <div className={styles.settingsDivider} />
        <p className={styles.settingsSectionLabel}>What to include in backups</p>

        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.include_diagrams}
            label="Diagrams"
            onChange={(v) => onChange({ include_diagrams: v })}
          />
        </div>
        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.include_interviews}
            label="Character interviews & panel sessions"
            onChange={(v) => onChange({ include_interviews: v })}
          />
        </div>
        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.include_chat_sessions}
            label="AI chat sessions"
            onChange={(v) => onChange({ include_chat_sessions: v })}
          />
        </div>
        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.include_activity_logs}
            label="Activity logs"
            onChange={(v) => onChange({ include_activity_logs: v })}
          />
          {settings.include_activity_logs && (
            <div className={styles.settingsSubRow}>
              <span className={styles.settingsFieldLabel}>Keep last</span>
              <NullableSelect
                value={settings.activity_log_limit}
                options={LOG_LIMIT_OPTIONS}
                onChange={(v) => onChange({ activity_log_limit: v })}
              />
            </div>
          )}
        </div>
        <div className={styles.settingsRow}>
          <IncludeToggle
            checked={settings.include_media_assets}
            label="Media assets"
            onChange={(v) => onChange({ include_media_assets: v })}
          />
        </div>
      </div>
    </Modal>
  );
}
