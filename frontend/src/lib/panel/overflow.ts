/**
 * Which tabs fit in the strip and which fold into the ☰ menu (refactor doc 11, phase 1).
 *
 * Pure so it can be tested without a DOM: the strip measures itself and hands the numbers
 * in. The active tab is always shown, even when it would not fit in order, because a tab
 * you just opened vanishing into a menu is the one thing an overflow must never do.
 */
/**
 * The tab strip's measures at the Default interface size, in px; the strip scales them with
 * `scaledPx`, since its text and controls are rem. Tabs shrink between `tabMin` and `tabMax`
 * (the label truncates, the full name is the tooltip), so what fits is decided at `tabMin`.
 */
export const STRIP_PX = {
  /** A tab at its narrowest: a few letters of its name (a page tab's icon and one or two). */
  tabMin: 64,
  tabMax: 140,
  /** The × the tab showing carries. */
  close: 24,
  /** Between the strip's items (`gap` on .strip). */
  gap: 2,
  /** + Open… after the tabs. */
  open: 26,
  /** ☰ n, once something has folded away. */
  overflow: 44,
  /** "Full page ↗" at the end, while a page beside the prose is showing (doc 24 D2). */
  fullPage: 84,
} as const;

/** The narrowest a tab may be drawn, the gap after it not included. */
export function tabMinWidth(active: boolean, px: (n: number) => number = (n) => n) {
  return px(STRIP_PX.tabMin) + (active ? px(STRIP_PX.close) : 0);
}

/**
 * What `fitTabs` needs for one strip: each tab's narrowest width plus the gap after it, the
 * width left for the tabs once + Open… (and "Full page ↗", while a page is showing) are taken
 * out of the strip's content width, and what the ☰ button takes when it appears.
 */
export function stripBudget<T extends { id: string }>(
  tabs: T[],
  activeId: string,
  contentWidth: number,
  { fullPage = false, px = (n: number) => n }: { fullPage?: boolean; px?: (n: number) => number } = {},
) {
  const gap = STRIP_PX.gap;
  const widths = Object.fromEntries(tabs.map((t) => [t.id, tabMinWidth(t.id === activeId, px) + gap]));
  // + Open… and the gap after it, the spacer's gap, Full page; 1px for rounding.
  const room = contentWidth - (px(STRIP_PX.open) + gap) - gap - (fullPage ? px(STRIP_PX.fullPage) : 0) - 1;
  return {
    widths,
    room,
    overflowReserve: px(STRIP_PX.overflow) + gap,
    defaultWidth: px(STRIP_PX.tabMin) + gap,
  };
}

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
