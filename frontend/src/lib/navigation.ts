/**
 * Router access for code that lives outside React (palette commands, hooks in stores).
 * `App` registers the router's navigate function once; everything else calls `navigateTo`.
 * Replaces `window.location.href = ...`, which reloaded the page and dropped store state.
 */
type Navigate = (to: string, opts?: { replace?: boolean; state?: unknown }) => void;

let navigateImpl: Navigate | null = null;

export function setNavigator(fn: Navigate | null): void {
  navigateImpl = fn;
}

export function navigateTo(to: string, opts?: { replace?: boolean; state?: unknown }): void {
  if (navigateImpl) navigateImpl(to, opts);
  else window.location.assign(to); // before the router mounts (should not happen in practice)
}

/**
 * Back through the pages you have been on (⌘[), as a browser's Back, but never out of the
 * app: the first page this tab opened has nothing of ours behind it. The router numbers
 * its entries (`history.state.idx`).
 */
export function goBack(): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) window.history.back();
}

/** Forward again (⌘]); nothing happens when there is nothing ahead. */
export function goForward(): void {
  window.history.forward();
}
