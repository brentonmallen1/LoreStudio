import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles, MessageSquare } from "lucide-react";
import styles from "./SelectionToolbar.module.css";

interface Props {
  /** DOMRect of the current text selection, or null if nothing is selected */
  selectionRect: DOMRect | null;
  onOpenCoach: () => void;
  onAddNote: () => void;
}

export default function SelectionToolbar({ selectionRect, onOpenCoach, onAddNote }: Props) {
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
      <button
        className={`${styles.btn} ${styles.coachBtn}`}
        onClick={onOpenCoach}
        title="Writing Coach — get feedback and alternative directions (⌘⇧R)"
      >
        <Sparkles size={12} />
        Writing Coach
      </button>
      <div className={styles.divider} />
      <button
        className={styles.btn}
        onClick={onAddNote}
        title="Add inline note (⌘⇧N)"
      >
        <MessageSquare size={12} />
        Note
      </button>
    </div>,
    document.body,
  );
}
