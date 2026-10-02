/**
 * The window below which the writing panel starts shut (doc 14 review): strip, a 360px
 * panel and a prose column of about 760px. Only the start: open it and it stays open.
 */
export const PANEL_ROOM_PX = 1240;

export function panelStartsOpen(saved: boolean, windowWidth: number): boolean {
  return saved && windowWidth >= PANEL_ROOM_PX;
}
