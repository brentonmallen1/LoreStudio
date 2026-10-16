import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Outline.module.css";

/**
 * The Cards' row of columns, which may be wider than the page. What is out of sight says so:
 * the edge with more fades, buttons above step a page of columns either way, and the bar
 * underneath shows. The row is a focusable region, so ← and → scroll it from the keyboard
 * (Tab into a card scrolls it into view too), and a trackpad scrolls it sideways as ever.
 */
export default function CardColumns({
  label,
  children,
  onDragEnd,
}: {
  label: string;
  children: ReactNode;
  onDragEnd?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const before = el.scrollLeft > 2;
    const after = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setMore((prev) => (prev.before === before && prev.after === after ? prev : { before, after }));
  }, []);

  // Columns come and go with every render; the width changes with the window and the panel.
  useLayoutEffect(measure);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [measure]);

  function step(dir: 1 | -1) {
    const el = box.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: still ? "auto" : "smooth" });
  }

  const overflowing = more.before || more.after;
  return (
    <div className={styles.columnsFrame}>
      {overflowing && (
        <div className={styles.columnsBar}>
          <span className={styles.columnsHint}>
            {more.after ? "More columns to the right" : "More columns to the left"}
          </span>
          <button
            type="button"
            className={styles.columnsStep}
            onClick={() => step(-1)}
            disabled={!more.before}
            aria-label="Show the columns before"
            title="Show the columns before"
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.columnsStep}
            onClick={() => step(1)}
            disabled={!more.after}
            aria-label="Show the columns after"
            title="Show the columns after"
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      )}
      <div
        className={styles.columnsClip}
        data-before={more.before || undefined}
        data-after={more.after || undefined}
      >
        <div
          ref={box}
          className={styles.columns}
          role="region"
          aria-label={label}
          tabIndex={overflowing ? 0 : -1}
          onScroll={measure}
          onDragEnd={onDragEnd}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
