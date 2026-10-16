import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./HoverTip.module.css";

const HOVER_MS = 350;
const MARGIN = 8;

interface Shown {
  text: string;
  top: number;
  left: number;
}

/**
 * One tooltip for a list of rows (doc 30 D2b): a row shows its line under it while the pointer
 * rests on it and as soon as the keyboard reaches it, and hides when either leaves. The words
 * also belong to the row (`describe`), so a screen reader hears them; the box itself is only
 * for the eye.
 */
export function useHoverTip(): {
  bind: (text: string | undefined) => {
    onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
    onMouseLeave?: () => void;
    onFocus?: (e: FocusEvent<HTMLElement>) => void;
    onBlur?: () => void;
  };
  hide: () => void;
  node: ReactNode;
} {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function place(el: HTMLElement, text: string) {
    const r = el.getBoundingClientRect();
    const left = Math.min(r.left + 28, window.innerWidth - MARGIN - 288);
    setShown({ text, top: r.bottom + 2, left: Math.max(MARGIN, left) });
  }
  function hide() {
    clearTimeout(timer.current);
    setShown(null);
  }

  return {
    bind: (text) =>
      text
        ? {
            onMouseEnter: (e) => {
              const el = e.currentTarget;
              clearTimeout(timer.current);
              timer.current = setTimeout(() => place(el, text), HOVER_MS);
            },
            onMouseLeave: hide,
            onFocus: (e) => {
              // Only the keyboard's focus: a click that focuses the row is already going there.
              let keyboard = true;
              try {
                keyboard = e.currentTarget.matches(":focus-visible");
              } catch {
                /* a browser without :focus-visible: show it */
              }
              if (keyboard) place(e.currentTarget, text);
            },
            onBlur: hide,
          }
        : {},
    hide,
    node: shown
      ? createPortal(
          <div className={styles.tip} style={{ top: shown.top, left: shown.left }} aria-hidden>
            {shown.text}
          </div>,
          document.body,
        )
      : null,
  };
}
