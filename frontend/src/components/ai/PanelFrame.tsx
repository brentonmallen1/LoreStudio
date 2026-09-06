import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal } from "lucide-react";
import { usePanelFrame } from "./usePanelFrame";
import styles from "./AIPanel.module.css";

/**
 * The panel's container, in either shape (doc 06 §2.2, tier 1).
 *
 * Docked it is the right rail, resizable from its left edge. Floating it is a window
 * portalled to `body`, dragged by its strip and resized from the bottom-right corner —
 * so the assistant can sit beside the paragraph it is talking about instead of pushing
 * the manuscript aside.
 */
export default function PanelFrame({ floating, children }: { floating: boolean; children: React.ReactNode }) {
  const { width, rect, startRailResize, startMove, startResize } = usePanelFrame(floating);

  // Docked, the panel takes space from the page; floating, it sits over it.
  useEffect(() => {
    document.documentElement.style.setProperty("--ai-panel-offset", floating ? "0px" : `${width}px`);
    return () => document.documentElement.style.setProperty("--ai-panel-offset", "0px");
  }, [floating, width]);

  if (!floating) {
    return (
      <aside className={styles.panel} style={{ width }}>
        <div className={styles.resizeHandle} onMouseDown={startRailResize} />
        {children}
      </aside>
    );
  }

  return createPortal(
    <aside
      className={`${styles.panel} ${styles.panelFloating}`}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label="AI assistant (floating)"
    >
      <div className={styles.dragStrip} onMouseDown={startMove} title="Drag to move">
        <GripHorizontal size={12} />
      </div>
      {children}
      <div className={styles.cornerHandle} onMouseDown={startResize} title="Drag to resize" />
    </aside>,
    document.body,
  );
}
