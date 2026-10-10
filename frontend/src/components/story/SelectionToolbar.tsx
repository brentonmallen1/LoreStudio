import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Diamond, Orbit, Feather, ListTodo, MessageSquare, Quote, Triangle } from "lucide-react";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import type { NoteKind } from "../../types/notes";
import styles from "./SelectionToolbar.module.css";

interface Props {
  /** DOMRect of the current text selection, or null if nothing is selected */
  selectionRect: DOMRect | null;
  onOpenCoach: () => void;
  /** A note, question or to-do on the selected words (doc 15). */
  onAddNote: (kind: NoteKind) => void;
  onAttributeDialogue?: () => void;
  /** The selected words as a clue toward (or away from) a twist's truth (doc 18 C6). */
  onPlantClue?: () => void;
  /** This scene as where a twist is revealed. */
  onRevealTwist?: () => void;
  onAnalyzeShowTell?: () => void;
  onAnalyzeAudience?: () => void;
  onClicheCoach?: () => void;
  /** Writer mode renders no AI entries at all. */
  showAI?: boolean;
}

export default function SelectionToolbar({
  selectionRect,
  onOpenCoach,
  onAddNote,
  onAttributeDialogue,
  onPlantClue,
  onRevealTwist,
  onAnalyzeShowTell,
  onAnalyzeAudience,
  onClicheCoach,
  showAI = true,
}: Props) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Keep toolbar position in sync with selectionRect
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || !selectionRect) return;

    const OFFSET = 8;
    const toolbarWidth = el.offsetWidth || 170;
    const toolbarHeight = el.offsetHeight || 36;

    let top = selectionRect.top + window.scrollY - toolbarHeight - OFFSET;
    let left = selectionRect.left + window.scrollX + selectionRect.width / 2 - toolbarWidth / 2;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
    if (top < 8) {
      // Flip below if not enough space above
      top = selectionRect.bottom + window.scrollY + OFFSET;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [selectionRect]);

  if (!selectionRect) return null;

  return createPortal(
    <div ref={toolbarRef} className={styles.toolbar} role="toolbar" aria-label="Text actions">
      {showAI && (
        <>
          <button
            className={`${styles.btn} ${styles.coachBtn}`}
            onClick={onOpenCoach}
            title="Writing Coach: feedback and alternative directions"
          >
            <Feather size={12} />
            Writing Coach
          </button>
          <div className={styles.divider} />
        </>
      )}
      <button
        className={styles.btn}
        onClick={() => onAddNote("note")}
        title={`Add a note (${formatCombo(SHORTCUTS.inlineNote.combo)})`}
      >
        <MessageSquare size={12} />
        Note
      </button>
      <button className={styles.btn} onClick={() => onAddNote("question")} title="Something undecided here">
        <CircleHelp size={12} />
        Question
      </button>
      <button className={styles.btn} onClick={() => onAddNote("todo")} title="Something to do here">
        <ListTodo size={12} />
        To-do
      </button>
      {onPlantClue && onRevealTwist && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={onPlantClue} title="These words as a clue for a twist">
            <Triangle size={12} />
            Plant a clue for…
          </button>
          <button
            className={styles.btn}
            onClick={onRevealTwist}
            title="Mark this scene as where a twist is revealed"
          >
            <Diamond size={12} />
            Reveal a twist here…
          </button>
        </>
      )}
      {showAI && onAnalyzeShowTell && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={onAnalyzeShowTell} title="Show Don't Tell analysis">
            <Orbit size={12} />
            Show/Tell
          </button>
        </>
      )}
      {showAI && onAnalyzeAudience && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={onAnalyzeAudience} title="Check target audience fit">
            <Orbit size={12} />
            Audience
          </button>
        </>
      )}
      {onAttributeDialogue && (
        <>
          <div className={styles.divider} />
          <button
            className={styles.btn}
            onClick={onAttributeDialogue}
            title={`Attribute dialogue to a character (${formatCombo(SHORTCUTS.attributeDialogue.combo)})`}
          >
            <Quote size={12} />
            Attribute
          </button>
        </>
      )}
      {showAI && onClicheCoach && (
        <>
          <div className={styles.divider} />
          <button
            className={styles.btn}
            onClick={onClicheCoach}
            title="Cliché Coach: discuss and address clichés in this passage"
          >
            <Feather size={12} />
            Cliche
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
