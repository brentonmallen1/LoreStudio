import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { whereWords } from "../../lib/patterns";
import type { Beat } from "../../types";
import styles from "./Pattern.module.css";

/**
 * The moment of the classic pattern a scene carries, as a tag on its line (doc 29 D5). It
 * opens a popover with what the moment is in plain words and roughly where it falls, and
 * "Not this one" to take it off the scene.
 */
export default function MomentTag({
  beat,
  pattern,
  onClear,
}: {
  beat: Beat;
  pattern: string;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();

  // Below the tag, or above it when there is no room; never off the side of the window.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const t = trigger.current?.getBoundingClientRect();
      const p = pop.current?.getBoundingClientRect();
      if (!t || !p) return;
      const below = t.bottom + 6;
      const top = below + p.height > window.innerHeight - 12 ? Math.max(12, t.top - 6 - p.height) : below;
      setAt({ top, left: Math.min(Math.max(12, t.right - p.width), window.innerWidth - 12 - p.width) });
    }
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    pop.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!pop.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function shut() {
    setOpen(false);
    setAt(null);
    trigger.current?.focus();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.tag}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Carries the moment ${beat.name}, from ${pattern}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {beat.name}
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={id}
            role="dialog"
            aria-label={beat.name}
            tabIndex={-1}
            className={styles.pop}
            style={at ?? { top: 0, left: 0, visibility: "hidden" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                shut();
              }
            }}
          >
            <span className={styles.where}>
              {pattern} · {whereWords(beat.position_pct)}
            </span>
            <span className={styles.popName}>{beat.name}</span>
            {beat.description && <p className={styles.popWhat}>{beat.description}</p>}
            {onClear && (
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  onClear();
                  shut();
                }}
              >
                Not this one
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
