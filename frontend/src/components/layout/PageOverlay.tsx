import { useEffect, useRef } from "react";
import { Undo2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { mentionIsOpen } from "../story/MentionDropdown";
import { slashIsOpen } from "../story/SlashCommandExtension";
import LogoMenu from "./LogoMenu";
import styles from "./PageOverlay.module.css";

interface Props {
  title: string;
  /** The page underneath, named on the close button ("Back to Write"). */
  backTo: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The frame Settings and Guides open in (lib/overlay.ts): full-window, with one way out
 * that says where it goes, and Esc as the other. Its bar is the app's header (doc 24): the
 * logo menu, the page's name, and the way back as a story's trail ends in it, ↩ and the page.
 */
export default function PageOverlay({ title, backTo, onClose, children }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);

  // Focus moves into the overlay so Esc and Tab work at once; the page underneath is inert.
  useEffect(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    // Capture phase, so this runs before the palette's own Esc handler closes it: Esc
    // should close the topmost layer only, and at this point the palette still says so.
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (useUIStore.getState().commandPaletteOpen) return;
      // A picker open in a guide's practice text (doc 26, P5) closes first.
      if (mentionIsOpen() || slashIsOpen()) return;
      const frame = frameRef.current;
      const otherLayer = Array.from(document.querySelectorAll('[role="dialog"]')).some(
        (el) => el !== frame && !el.closest("[inert]"),
      );
      if (otherLayer) return;
      e.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <header className={styles.bar}>
        <LogoMenu />
        <span className={styles.title}>{title}</span>
        <button
          type="button"
          className={styles.back}
          onClick={onClose}
          title={`Back to ${backTo} (Esc)`}
          aria-label={`Back to ${backTo}`}
        >
          <Undo2 size={14} aria-hidden />
          <span className={styles.backLabel}>{backTo}</span>
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
