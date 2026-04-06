import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import GlobalHeader from "./GlobalHeader";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";
import { useUIStore } from "../../stores/uiStore";
import AIPanel from "../ai/AIPanel";
import styles from "./GlobalLayout.module.css";

export default function GlobalLayout() {
  const { viewState } = useUIStore();
  const isFocused = viewState !== "normal";
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only fire when not typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
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
      <AIPanel />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}
