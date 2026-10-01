import { useRef, useState } from "react";
import { EXPANDED_MAX_PX, EXPANDED_MIN_PX, clampStripPx } from "../../lib/strip/stripModel";
import styles from "./Strip.module.css";

const STEP = 16;

/**
 * The expanded strip's right edge (doc 14 strip). Dragging it resizes the strip as the
 * pointer moves, between a floor that keeps its header whole and a ceiling, and the width is
 * kept when you let go. Collapsing to the line is the header's button, not a drag: the old
 * edge snapped between three widths only on release, so nothing showed what a drag would do.
 */
export default function StripEdge({
  px,
  onDrag,
  onCommit,
}: {
  px: number;
  /** The live width while dragging, or null when the drag ends. */
  onDrag: (px: number | null) => void;
  onCommit: (px: number) => void;
}) {
  const start = useRef<{ x: number; px: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, px };
    setDragging(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    onDrag(clampStripPx(start.current.px + e.clientX - start.current.x));
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const next = clampStripPx(start.current.px + e.clientX - start.current.x);
    start.current = null;
    setDragging(false);
    onDrag(null);
    onCommit(next);
  }

  return (
    <div
      className={styles.edge}
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label="Story strip width"
      aria-valuemin={EXPANDED_MIN_PX}
      aria-valuemax={EXPANDED_MAX_PX}
      aria-valuenow={px}
      tabIndex={0}
      title="Drag to widen or narrow"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          onCommit(clampStripPx(px + (e.key === "ArrowRight" ? STEP : -STEP)));
        }
      }}
    />
  );
}
