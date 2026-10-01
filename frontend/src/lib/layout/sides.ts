import type { StripWidth } from "../strip/stripModel";

/**
 * Collapse both sides at once (doc 13 P2): the strip down to its line and the side panel
 * shut, so the prose has the window; the same control puts back what was there.
 */
export interface Sides {
  strip: StripWidth;
  panelOpen: boolean;
}

const RESTORE_DEFAULT: Sides = { strip: "chapters", panelOpen: true };

export function sidesCollapsed(s: Sides): boolean {
  return s.strip === "strip" && !s.panelOpen;
}

/** The next layout, and what to remember for the way back. */
export function toggleSides(
  current: Sides,
  remembered: Sides | null,
): { next: Sides; remember: Sides | null } {
  if (sidesCollapsed(current)) {
    const back = remembered && !sidesCollapsed(remembered) ? remembered : RESTORE_DEFAULT;
    return { next: back, remember: null };
  }
  return { next: { strip: "strip", panelOpen: false }, remember: current };
}

/**
 * The window below which the writing panel starts shut (doc 14 review): strip, a 360px
 * panel and a prose column of about 760px. Only the start: open it and it stays open.
 */
export const PANEL_ROOM_PX = 1240;

export function panelStartsOpen(saved: boolean, windowWidth: number): boolean {
  return saved && windowWidth >= PANEL_ROOM_PX;
}
