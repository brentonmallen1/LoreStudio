/**
 * Telling the open editor that its scene was rewritten from outside it.
 *
 * The editor loads a scene's text when you open it and keeps its own copy after that.
 * Quote conversion, story-wide replace and undo rewrite scenes on the server; if one of
 * them is open, its editor still holds the old text — and the next autosave used to
 * write that back over the change, with no conflict, because the same operations had
 * refreshed the store's `updated_at` underneath it. Whatever rewrites scenes announces
 * them here, and the editor decides what to do (see `useSceneAutosave`).
 */
export const SCENES_REWRITTEN_EVENT = "ls:scenes-rewritten";

export function announceScenesRewritten(nodeIds: string[]): void {
  if (nodeIds.length) window.dispatchEvent(new CustomEvent(SCENES_REWRITTEN_EVENT, { detail: { nodeIds } }));
}
