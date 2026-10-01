import { useRef, useState } from "react";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { WIDTH_PX, snapWidth, stepWidth, type StripWidth } from "../../lib/strip/stripModel";
import styles from "./Strip.module.css";

const MIN = 48;
const MAX = 380;

/**
 * The strip's right edge (doc 13 P2, D7). It looked like a handle and only cycled when
 * clicked; now it is one: drag it and the strip follows, then settles on the nearest of
 * its three widths. Arrow keys do the same a step at a time.
 */
export default function StripEdge({
  width,
  hasStations,
  onWidth,
  onDrag,
}: {
  width: StripWidth;
  hasStations: boolean;
  onWidth: (w: StripWidth) => void;
  /** The live width while dragging, or null when the drag ends. */
  onDrag: (px: number | null) => void;
}) {
  const start = useRef<{ x: number; px: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, px: WIDTH_PX[width] };
    setDragging(true);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    onDrag(Math.min(MAX, Math.max(MIN, start.current.px + e.clientX - start.current.x)));
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const px = start.current.px + e.clientX - start.current.x;
    start.current = null;
    setDragging(false);
    onDrag(null);
    onWidth(snapWidth(px, hasStations));
  }

  return (
    <div
      className={styles.edge}
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label="Story strip width"
      aria-valuemin={WIDTH_PX.strip}
      aria-valuemax={WIDTH_PX.scenes}
      aria-valuenow={WIDTH_PX[width]}
      tabIndex={0}
      title={`Drag to widen or narrow (${formatCombo(SHORTCUTS.cycleStrip.combo)})`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          onWidth(stepWidth(width, hasStations, e.key === "ArrowRight" ? 1 : -1));
        }
      }}
    />
  );
}
