import { useEffect } from "react";
import { X } from "lucide-react";
import { commandRegistry } from "../../lib/commands/registry";
import { formatCombo, shortcutsFor } from "../../lib/keyboard/shortcuts";
import { useMode } from "../../lib/mode";
import styles from "./KeyboardShortcutsModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** The `?` overlay. Rendered from lib/keyboard/shortcuts.ts plus any palette command that declares a shortcut. */
export default function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  const mode = useMode();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rows: Record<string, { label: string; keys: string }[]> = {};
  const shortcuts = shortcutsFor(mode);
  for (const s of shortcuts) {
    (rows[s.group] ??= []).push({ label: s.label, keys: formatCombo(s.combo) });
  }
  // Commands whose key is in the table above are listed once, from the table.
  const listed = new Set(shortcuts.map((s) => s.commandId).filter(Boolean));
  for (const action of commandRegistry.getAll()) {
    if (!action.shortcut || listed.has(action.id)) continue;
    if (action.when && !action.when()) continue;
    (rows[action.group] ??= []).push({ label: action.label, keys: action.shortcut });
  }
  rows["Editor"] = [...(rows["Editor"] ?? []), { label: "New line without paragraph", keys: "Shift+Enter" }];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Keyboard shortcuts</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className={styles.body}>
          {Object.entries(rows).map(([group, items]) => (
            <div key={group} className={styles.group}>
              <p className={styles.groupLabel}>{group}</p>
              {items.map((item) => (
                <div key={item.label} className={styles.row}>
                  <span className={styles.rowLabel}>{item.label}</span>
                  <kbd className={styles.kbd}>{item.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className={styles.footer}>
          Everything here is also in the command palette ({formatCombo("mod+k")}).
        </p>
      </div>
    </div>
  );
}
