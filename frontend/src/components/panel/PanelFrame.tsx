import { createPortal } from "react-dom";
import { ExternalLink, GripHorizontal } from "lucide-react";
import { usePanelStore, type PanelFrameMode } from "../../stores/panelStore";
import { usePanelFrame } from "./usePanelFrame";
import styles from "./Panel.module.css";

interface Props {
  frame: PanelFrameMode;
  /** In its own window the panel is the whole page. */
  fill?: boolean;
  children: React.ReactNode;
}

/**
 * The side panel's container in each of its shapes (refactor doc 11, phase 5). Docked it
 * is a column in the workspace row, resizable from its left edge; floating it is a window
 * portalled over the page, dragged by its strip; popped out, this window shows only a
 * strip saying where it went, with a way back.
 */
export default function PanelFrame({ frame, fill = false, children }: Props) {
  const { width, rect, startRailResize, startMove, startResize } = usePanelFrame(frame === "floating", {
    widthKey: "ls_panel_width",
    rectKey: "ls_panel_rect",
    defaultWidth: 360,
  });
  const setFrame = usePanelStore((s) => s.setFrame);

  if (fill) {
    return (
      <aside className={`${styles.panel} ${styles.panelFill}`} aria-label="Side panel">
        {children}
      </aside>
    );
  }
  if (frame === "window") {
    return (
      <div className={styles.awayStrip} role="status">
        <ExternalLink size={12} />
        <span>The side panel is open in another window</span>
        <button className={styles.awayBtn} onClick={() => setFrame("docked")}>
          Bring it back
        </button>
      </div>
    );
  }
  if (frame === "floating") {
    return createPortal(
      <aside
        className={`${styles.panel} ${styles.panelFloating}`}
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        aria-label="Side panel (floating)"
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
  return (
    <aside className={styles.panel} style={{ width }} aria-label="Side panel">
      <div className={styles.resizeHandle} onMouseDown={startRailResize} title="Drag to resize" />
      {children}
    </aside>
  );
}
