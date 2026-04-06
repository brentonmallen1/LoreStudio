import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { commandRegistry } from "../../lib/commands/registry";
import styles from "./KeyboardShortcutsModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Collect all commands with shortcuts, grouped
  const all = commandRegistry.getAll().filter((a) => !!a.shortcut);
  const groups: Record<string, typeof all> = {};
  for (const action of all) {
    if (!groups[action.group]) groups[action.group] = [];
    groups[action.group].push(action);
  }

  // Built-in shortcuts not in the registry
  const builtIn: Array<{ label: string; shortcut: string; group: string }> = [
    { group: "Navigation", label: "Command palette", shortcut: "⌘K" },
    { group: "Navigation", label: "Keyboard shortcuts", shortcut: "?" },
    { group: "Editor", label: "New line", shortcut: "Shift+Enter" },
  ];
  const builtInGroups: Record<string, typeof builtIn> = {};
  for (const item of builtIn) {
    if (!builtInGroups[item.group]) builtInGroups[item.group] = [];
    builtInGroups[item.group].push(item);
  }

  const allGroups = new Set([...Object.keys(builtInGroups), ...Object.keys(groups)]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <Keyboard size={15} className={styles.headerIcon} />
          <span className={styles.title}>Keyboard shortcuts</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={14} /></button>
        </div>

        <div className={styles.body}>
          {Array.from(allGroups).map((group) => (
            <div key={group} className={styles.group}>
              <p className={styles.groupLabel}>{group}</p>
              {(builtInGroups[group] ?? []).map((item) => (
                <div key={item.label} className={styles.row}>
                  <span className={styles.rowLabel}>{item.label}</span>
                  <kbd className={styles.kbd}>{item.shortcut}</kbd>
                </div>
              ))}
              {(groups[group] ?? []).map((action) => (
                <div key={action.id} className={styles.row}>
                  <span className={styles.rowLabel}>{action.label}</span>
                  <kbd className={styles.kbd}>{action.shortcut}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
