import { formatCombo, shortcutsFor } from "../../lib/keyboard/shortcuts";
import { useMode } from "../../lib/mode";
import { commandRegistry } from "../../lib/commands/registry";
import styles from "../../pages/Settings.module.css";

/** Read-only shortcut table, rendered from lib/keyboard/shortcuts.ts (remapping is a later stage). */
export default function ShortcutsSection() {
  const mode = useMode();
  const rows = shortcutsFor(mode).map((s) => ({
    group: s.group,
    label: s.label,
    keys: formatCombo(s.combo),
  }));
  for (const action of commandRegistry.getAll()) {
    if (action.shortcut && (!action.when || action.when())) {
      rows.push({
        group: action.group as (typeof rows)[number]["group"],
        label: action.label,
        keys: action.shortcut,
      });
    }
  }
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  return (
    <div className={styles.card}>
      <p className={styles.sectionHint}>
        Press <kbd>?</kbd> anywhere for this list. Everything here is also in the command palette (
        {formatCombo("mod+k")}).
      </p>
      {groups.map((g) => (
        <div key={g} className={styles.settingGroup}>
          <p className={styles.settingGroupLabel}>{g}</p>
          {rows
            .filter((r) => r.group === g)
            .map((r) => (
              <div key={r.label} className={styles.fieldRow}>
                <span className={styles.label}>{r.label}</span>
                <kbd className={styles.kbd}>{r.keys}</kbd>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
