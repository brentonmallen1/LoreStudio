import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Geometry for the side panel in both its shapes (doc 06 §2.2, doc 11 P5).
 *
 * Docked, the panel is a right rail with a width. Floating, it is a window with a
 * position and a size that the author drags around — over the manuscript, or onto a
 * second monitor. Both are per-browser preferences, so they live in localStorage rather
 * than on the account.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WIDTH_KEY = "ls_ai_panel_width";
const RECT_KEY = "ls_ai_panel_rect";

export const MIN_WIDTH = 280;
export const MAX_WIDTH = 600;
const MIN_HEIGHT = 240;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Site data blocked: the panel still works, it just forgets where it was.
  }
}

/** A first floating position: roughly where the docked panel was, nudged into view. */
function defaultRect(width: number): Rect {
  const height = Math.min(620, Math.max(MIN_HEIGHT, window.innerHeight - 160));
  return {
    x: Math.max(16, window.innerWidth - width - 48),
    y: 80,
    width,
    height,
  };
}

/** Keep the window reachable when the viewport shrinks or a monitor disappears. */
function clamp(rect: Rect): Rect {
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), Math.max(MIN_WIDTH, window.innerWidth - 32));
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, window.innerHeight - 32));
  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, 0), Math.max(0, window.innerWidth - width)),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, window.innerHeight - height)),
  };
}

export interface PanelFrameOptions {
  /** localStorage keys, so a second panel (the story panel, doc 11) keeps its own size. */
  widthKey?: string;
  rectKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function usePanelFrame(floating: boolean, options: PanelFrameOptions = {}) {
  const {
    widthKey = WIDTH_KEY,
    rectKey = RECT_KEY,
    defaultWidth = 340,
    minWidth = MIN_WIDTH,
    maxWidth = MAX_WIDTH,
  } = options;
  const [width, setWidth] = useState(() => read<number>(widthKey, defaultWidth));
  const [rect, setRect] = useState<Rect>(() =>
    clamp(read<Rect>(rectKey, defaultRect(read(widthKey, defaultWidth)))),
  );
  const drag = useRef<{
    mode: "move" | "resize" | "rail";
    x: number;
    y: number;
    rect: Rect;
    /** Latest geometry from this drag, so mouseup can persist it without reading render state. */
    latest: { width: number; rect: Rect };
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.mode === "rail") {
        const next = Math.max(minWidth, Math.min(maxWidth, d.rect.width - dx));
        d.latest.width = next;
        setWidth(next);
      } else if (d.mode === "move") {
        const next = clamp({ ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy });
        d.latest.rect = next;
        setRect(next);
      } else {
        const next = clamp({ ...d.rect, width: d.rect.width + dx, height: d.rect.height + dy });
        d.latest.rect = next;
        setRect(next);
      }
    }
    function onUp() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      document.documentElement.removeAttribute("data-panel-resizing");
      if (d.mode === "rail") write(widthKey, d.latest.width);
      else write(rectKey, d.latest.rect);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [widthKey, rectKey, minWidth, maxWidth]);

  // A resized window (or a disconnected monitor) must not strand the panel offscreen.
  useEffect(() => {
    if (!floating) return;
    function onResize() {
      setRect((r) => clamp(r));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [floating]);

  const start = useCallback(
    (mode: "move" | "resize" | "rail") => (e: React.MouseEvent) => {
      drag.current = {
        mode,
        x: e.clientX,
        y: e.clientY,
        rect: mode === "rail" ? { ...rect, width } : rect,
        latest: { width, rect },
      };
      document.documentElement.setAttribute("data-panel-resizing", "");
      e.preventDefault();
    },
    [rect, width],
  );

  return {
    width,
    rect,
    startRailResize: start("rail"),
    startMove: start("move"),
    startResize: start("resize"),
  };
}
