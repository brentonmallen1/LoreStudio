import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import GlobalHeader from "./GlobalHeader";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";
import { useUIStore } from "../../stores/uiStore";
import { useHistoryStore } from "../../stores/historyStore";
import AIPanel from "../ai/AIPanel";
import { useMode } from "../../lib/mode";
import { commandRegistry } from "../../lib/commands/registry";
import styles from "./GlobalLayout.module.css";

export default function GlobalLayout() {
  const { viewState } = useUIStore();
  const isFocused = viewState !== "normal";
  const mode = useMode();

  // Writer mode: AI commands never appear in the palette.
  useEffect(() => {
    commandRegistry.setGlobalFilter(mode === "writer" ? (a) => a.group !== "AI" : null);
    return () => commandRegistry.setGlobalFilter(null);
  }, [mode]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      const inTextField = tag === "INPUT" || tag === "TEXTAREA" || editable;

      // Ctrl/Cmd+Z: custom undo outside text fields; let browser handle inside them
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (!inTextField) {
          const entry = useHistoryStore.getState().pop();
          if (entry) {
            e.preventDefault();
            entry.undo();
          }
        }
        return;
      }

      // Ctrl/Cmd+Shift+Z: redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        if (!inTextField) {
          e.preventDefault();
          useHistoryStore.getState().redo();
        }
        return;
      }

      // All other shortcuts: skip when typing
      if (inTextField) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      // ⌘⇧F: focus mode (hide chrome, hover-reveal sidebar)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        const { viewState: v, setViewState } = useUIStore.getState();
        setViewState(v === "focus" ? "normal" : "focus");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.shell}>
      <GlobalHeader />
      <div className={`${styles.content} ${isFocused ? styles.contentFocused : styles.contentNormal}`}>
        <Outlet />
      </div>
      {mode === "studio" && <AIPanel />}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}
