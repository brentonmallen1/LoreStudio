import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import GlobalHeader from "./GlobalHeader";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";
import FocusExit from "./FocusExit";
import { mentionIsOpen } from "../story/MentionDropdown";
import { slashIsOpen } from "../story/SlashCommandExtension";
import { useUIStore } from "../../stores/uiStore";
import { useAIAvailable } from "../../lib/mode";
import { commandRegistry } from "../../lib/commands/registry";
import { SHORTCUTS, yieldsToTyping, matchesCombo } from "../../lib/keyboard/shortcuts";
import { startAISync } from "../../lib/ai/aiSync";
import { startPanelSync } from "../../lib/panel/panelSync";
import { usePanelStore } from "../../stores/panelStore";
import { useFocusExitHost } from "../../lib/focusExit";
import { goBack, goForward } from "../../lib/navigation";
import styles from "./GlobalLayout.module.css";

export default function GlobalLayout() {
  const { viewState } = useUIStore();
  const isFocused = viewState !== "normal";
  // The prose's status corner holds the way out itself (doc 24): one, never two.
  const exitHosted = useFocusExitHost((s) => s.hosts > 0);
  const aiAvailable = useAIAvailable();

  // Keep this window's panel in step with one opened in its own window (doc 06 §2.2).
  useEffect(() => startAISync("main"), []);
  useEffect(() => startPanelSync("main"), []);

  // Writer mode, or the AI switch off: AI commands never appear in the palette.
  useEffect(() => {
    commandRegistry.setGlobalFilter(aiAvailable ? null : (a) => a.group !== "AI");
    return () => commandRegistry.setGlobalFilter(null);
  }, [aiAvailable]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Undo/redo (⌘Z / ⌘⇧Z) is handled by the header's useUndoRedo hook. A bare key
      // stands aside while the author types; a ⌘/⌥ combination never types anything.
      if (yieldsToTyping(e)) return;
      if (matchesCombo(e, SHORTCUTS.help.combo)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      // ⌘[ / ⌘]: Back and Forward through where you have been, everywhere, never out of the app.
      if (matchesCombo(e, SHORTCUTS.back.combo)) {
        e.preventDefault();
        goBack();
      }
      if (matchesCombo(e, SHORTCUTS.forward.combo)) {
        e.preventDefault();
        goForward();
      }
      // Focus mode (hide chrome, hover-reveal sidebar)
      if (matchesCombo(e, SHORTCUTS.focusMode.combo)) {
        e.preventDefault();
        const { viewState: v, setViewState } = useUIStore.getState();
        setViewState(v === "focus" ? "normal" : "focus");
      }
      // The Assistant tab shows or hides with ⌘J, inert in Writer mode, with the switch off
      // and outside a story (it works on one book); the whole side panel floats or docks with
      // ⌘⇧J in both modes (doc 11 P5).
      const inStory = window.location.pathname.startsWith("/stories/");
      if (aiAvailable && inStory && matchesCombo(e, SHORTCUTS.toggleAIPanel.combo)) {
        e.preventDefault();
        usePanelStore.getState().toggleAssistant();
      }
      if (matchesCombo(e, SHORTCUTS.togglePanel.combo)) {
        e.preventDefault();
        usePanelStore.getState().toggle();
      }
      if (matchesCombo(e, SHORTCUTS.floatAIPanel.combo)) {
        e.preventDefault();
        usePanelStore.getState().toggleFloating();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiAvailable]);

  // Escape leaves focus mode, from the prose too (doc 13 P2). Caught before anything else
  // sees it, since ProseMirror cancels every Escape; anything open on the page keeps it.
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key !== "Escape" || useUIStore.getState().viewState !== "focus" || somethingOpen(e)) return;
      useUIStore.getState().setViewState("normal");
    }
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, []);

  return (
    <div className={styles.shell}>
      <GlobalHeader />
      <div className={`${styles.content} ${isFocused ? styles.contentFocused : styles.contentNormal}`}>
        <Outlet />
      </div>
      {isFocused && !exitHosted && <FocusExit />}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}

/** A field, dialog, menu or picker that Escape should close before it leaves focus mode. */
function somethingOpen(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select")) return true;
  if (mentionIsOpen() || slashIsOpen()) return true;
  return !!document.querySelector(
    '[role="dialog"], [role="menu"], [role="listbox"], [aria-modal="true"], [data-card-id][data-active]',
  );
}
