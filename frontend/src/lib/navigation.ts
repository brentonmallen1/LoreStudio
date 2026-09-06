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
