import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Search, Maximize2, Minimize2, NotepadText } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import UndoRedoButtons from "./UndoRedoButtons";
import { isUntouchedField } from "../../lib/undo/fieldFocus";
import JobsIndicator from "./jobs/JobsIndicator";
import HeaderTitle from "./HeaderTitle";
import { SHORTCUTS, formatCombo, isTypingTarget, matchesCombo } from "../../lib/keyboard/shortcuts";
import { useUIStore } from "../../stores/uiStore";
import { usePanelStore } from "../../stores/panelStore";
import { scratchPadHasWords, useScratchPadStore } from "../../stores/scratchPadStore";
import styles from "./GlobalHeader.module.css";

/**
 * The header (doc 24): it floats on the page ground with no background or rule. On the left
 * the logo menu and the trail of where you are (HeaderTitle); on the right only the jobs,
 * undo and redo, the scratch pad, focus mode and "Search or jump", all one quiet tier
 * (D9). Everything else it used to hold lives in the logo menu and the palette: the
 * backup, the mode, Guides, settings, the colour mode, the account and the Assistant (whose
 * entry beside the page is the panel rail's Feather, ⌘J and ⌘/).
 */
export default function GlobalHeader() {
  const { storyId } = useParams<{ storyId: string }>();
  const aiAvailable = useAIAvailable();
  const undoRedo = useUndoRedo();
  const { setCommandPaletteOpen, viewState, setViewState, toggleScratchPad, scratchPadOpen } = useUIStore();

  const isFocused = viewState === "focus";
  const [revealed, setRevealed] = useState(false);
  // The dot says the scratch pad has words in it; the page loads once, then the drawer keeps it.
  const scratchHasContent = useScratchPadStore(scratchPadHasWords);
  const scratchLoaded = useScratchPadStore((s) => s.loaded);
  useEffect(() => {
    if (!scratchLoaded)
      void useScratchPadStore
        .getState()
        .load()
        .catch(() => {});
  }, [scratchLoaded]);

  // ⌘/ shows or hides the Assistant: in Studio mode, inside a story (it works on one book).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!matchesCombo(e, SHORTCUTS.assistant.combo)) return;
      e.preventDefault();
      if (aiAvailable && storyId) usePanelStore.getState().toggleAssistant();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [aiAvailable, storyId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isUndo = matchesCombo(e, SHORTCUTS.undo.combo);
      const isRedo = matchesCombo(e, SHORTCUTS.redo.combo);
      if (!isUndo && !isRedo) return;
      // The prose sends ⌘Z here through its own keymap; other editors and a field with typing
      // in it keep their own history (doc 23 P5b).
      if (isTypingTarget(e) && !isUntouchedField(e)) return;
      e.preventDefault();
      if (isRedo) undoRedo.redo();
      else undoRedo.undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoRedo]);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // When returning to normal mode, immediately show header
  useEffect(() => {
    if (!isFocused) setRevealed(false);
  }, [isFocused]);

  function startHide() {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setRevealed(false), 600);
  }

  function cancelHide() {
    clearTimeout(hideTimerRef.current);
  }

  return (
    <>
      {/* Hover zone — thin strip at top of screen that reveals header in focus mode */}
      {isFocused && !revealed && (
        <div
          className={styles.hoverZone}
          onMouseEnter={() => {
            cancelHide();
            setRevealed(true);
          }}
        />
      )}

      <header
        className={`${styles.header} ${isFocused ? (revealed ? styles.headerRevealed : styles.headerHidden) : ""}`}
        onMouseEnter={isFocused ? cancelHide : undefined}
        onMouseLeave={isFocused ? startHide : undefined}
      >
        <div className={styles.left}>
          <HeaderTitle />
        </div>

        <div className={styles.right}>
          <JobsIndicator />
          <UndoRedoButtons undoRedo={undoRedo} />
          <button
            onClick={toggleScratchPad}
            className={`${styles.iconBtn} ${scratchPadOpen ? styles.iconBtnActive : ""}`}
            title={`Scratch pad (${formatCombo(SHORTCUTS.scratchPad.combo)})`}
            aria-label="Scratch pad"
            aria-pressed={scratchPadOpen}
            style={{ position: "relative" }}
          >
            <NotepadText size={16} />
            {scratchHasContent && !scratchPadOpen && <span className={styles.scratchDot} />}
          </button>
          <button
            onClick={() => setViewState(isFocused ? "normal" : "focus")}
            className={`${styles.iconBtn} ${isFocused ? styles.iconBtnActive : ""}`}
            title={`${isFocused ? "Leave focus mode" : "Focus mode"} (${formatCombo(SHORTCUTS.focusMode.combo)})`}
            aria-label={isFocused ? "Leave focus mode" : "Focus mode"}
            aria-pressed={isFocused}
          >
            {isFocused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className={styles.searchBtn}
            title="Search, or jump to any page, scene or command"
          >
            <Search size={15} aria-hidden />
            <span>Search or jump</span>
            <kbd>{formatCombo(SHORTCUTS.palette.combo)}</kbd>
          </button>
        </div>
      </header>
    </>
  );
}
