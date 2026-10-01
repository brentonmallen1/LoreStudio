import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Compass, Feather, MessageSquare, Quote } from "lucide-react";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import styles from "./SelectionToolbar.module.css";

interface Props {
  /** DOMRect of the current text selection, or null if nothing is selected */
  selectionRect: DOMRect | null;
  onOpenCoach: () => void;
  onAddNote: () => void;
  onAttributeDialogue?: () => void;
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
            title={`Writing Coach: feedback and alternative directions (${formatCombo(SHORTCUTS.writingCoach.combo)})`}
          >
            <Feather size={12} />
            Writing Coach
          </button>
          <div className={styles.divider} />
        </>
      )}
      <button
        className={styles.btn}
        onClick={onAddNote}
        title={`Add a note (${formatCombo(SHORTCUTS.inlineNote.combo)})`}
      >
        <MessageSquare size={12} />
        Note
      </button>
      {showAI && onAnalyzeShowTell && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={onAnalyzeShowTell} title="Show Don't Tell analysis">
            <Compass size={12} />
            Show/Tell
          </button>
        </>
      )}
      {showAI && onAnalyzeAudience && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={onAnalyzeAudience} title="Check target audience fit">
            <Compass size={12} />
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
            title="Cliche Coach: discuss and address clichés in this passage"
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
