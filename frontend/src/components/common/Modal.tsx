import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  size = "md",
  children,
  footer,
  zIndex,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog on next tick so it's in the DOM. A field that already took focus
      // (autoFocus) keeps it; otherwise the first field, not the header's close button —
      // "New Story" used to open with the cursor on ✕ instead of in Title.
      requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        if (!dialog || dialog.contains(document.activeElement)) return;
        const field = dialog.querySelector<HTMLElement>(
          "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled])",
        );
        const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
        (field ?? firstFocusable ?? dialog).focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portalled to the body. A modal opened from inside the AI panel used to render into
  // the panel's stacking context, which sits below the rest of the app — so the chat
  // settings appeared *under* the window that opened them. z-index cannot climb out of
  // an ancestor's stacking context; only leaving the subtree can.
  return createPortal(
    <div
      className={styles.overlay}
      style={zIndex !== undefined ? { zIndex } : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${styles.dialog} ${styles[size]}`}
        tabIndex={-1}
      >
        <div className={styles.header}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
