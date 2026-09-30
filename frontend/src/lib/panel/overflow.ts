/**
 * Which tabs fit in the strip and which fold into the ☰ menu (refactor doc 11, phase 1).
 *
 * Pure so it can be tested without a DOM: the strip measures itself and hands the numbers
 * in. The active tab is always shown, even when it would not fit in order, because a tab
 * you just opened vanishing into a menu is the one thing an overflow must never do.
 */
export interface FitResult<T> {
  visible: T[];
  hidden: T[];
}

export function fitTabs<T extends { id: string }>(
  tabs: T[],
  /** Rendered width of each tab, by id; a tab not measured yet is assumed `defaultWidth`. */
  widths: Record<string, number>,
  /** Width available to the tabs themselves. */
  available: number,
  activeId: string,
  /** Width the ☰ button and anything pinned beside it take when overflow happens. */
  reserved = 0,
  defaultWidth = 96,
): FitResult<T> {
  const w = (t: T) => widths[t.id] ?? defaultWidth;
  const total = tabs.reduce((n, t) => n + w(t), 0);
  if (total <= available) return { visible: tabs, hidden: [] };

  const room = Math.max(0, available - reserved);
  const active = tabs.find((t) => t.id === activeId);
  let used = active ? w(active) : 0;
  const visible: T[] = [];
  for (const t of tabs) {
    if (t === active) {
      visible.push(t);
      continue;
    }
    if (used + w(t) <= room) {
      visible.push(t);
      used += w(t);
    }
  }
  // Keep document order even when the active tab jumped the queue.
  const shown = new Set(visible.map((t) => t.id));
  return { visible: tabs.filter((t) => shown.has(t.id)), hidden: tabs.filter((t) => !shown.has(t.id)) };
}
