import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import GlobalHeader from "./GlobalHeader";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";
import { useUIStore } from "../../stores/uiStore";
import AIPanel from "../ai/AIPanel";
import { useAIAvailable } from "../../lib/mode";
import { commandRegistry } from "../../lib/commands/registry";
import { SHORTCUTS, isTypingTarget, matchesCombo } from "../../lib/keyboard/shortcuts";
import styles from "./GlobalLayout.module.css";

export default function GlobalLayout() {
  const { viewState } = useUIStore();
  const isFocused = viewState !== "normal";
  const aiAvailable = useAIAvailable();

  // Writer mode, or the AI switch off: AI commands never appear in the palette.
  useEffect(() => {
    commandRegistry.setGlobalFilter(aiAvailable ? null : (a) => a.group !== "AI");
    return () => commandRegistry.setGlobalFilter(null);
  }, [aiAvailable]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inTextField = isTypingTarget(e);

      // Undo/redo (⌘Z / ⌘⇧Z) is handled by the header's useUndoRedo hook.
      // All other shortcuts: skip when typing
      if (inTextField) return;
      if (matchesCombo(e, SHORTCUTS.help.combo)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      // Focus mode (hide chrome, hover-reveal sidebar)
      if (matchesCombo(e, SHORTCUTS.focusMode.combo)) {
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
      {aiAvailable && <AIPanel />}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}
