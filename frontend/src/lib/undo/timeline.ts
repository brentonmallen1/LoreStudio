/**
 * One undo timeline for everything the author does in a story (doc 23 P5b).
 *
 * Two histories hold the author's actions: the open scene's editor (typing) and the server's
 * change log (everything else, prose rewrites included). ⌘Z means "undo the last thing I did",
 * so this keeps the order between them: each step says which history to ask. The histories
 * still do the undoing; this only decides whose turn it is.
 *
 * Pure: the caller says which steps are still live (an editor step whose scene is no longer
 * open, or whose history was reset, is not, and is passed over).
 */

export type Step =
  | { kind: "server"; batch: string | null }
  /** `session` changes whenever the editor's history is reset (another scene, a reload). */
  | { kind: "editor"; nodeId: string; session: number };

export interface Timeline {
  done: Step[];
  undone: Step[];
  /** Something happened since the timeline began. Until then, redo may reach the server's
   * own redo (a change undone before this page loaded); after, a new action has cleared it. */
  touched: boolean;
}

export const EMPTY_TIMELINE: Timeline = { done: [], undone: [], touched: false };

/** Kept short of growing forever; older steps fall back to the server's own order. */
export const MAX_STEPS = 500;

/** A new action: on top of the timeline, and nothing left to redo. */
export function act(t: Timeline, step: Step): Timeline {
  return { done: [...t.done, step].slice(-MAX_STEPS), undone: [], touched: true };
}

/**
 * The step ⌘Z should take back, with dead steps above it dropped. `null` when nothing in the
 * timeline is live: the caller may then fall back to the server's own undo (changes made
 * before this page loaded).
 */
export function nextUndo(t: Timeline, live: (s: Step) => boolean): { step: Step | null; timeline: Timeline } {
  const done = [...t.done];
  while (done.length && !live(done[done.length - 1])) done.pop();
  return { step: done[done.length - 1] ?? null, timeline: { ...t, done } };
}

/** As `nextUndo`, for ⇧⌘Z. */
export function nextRedo(t: Timeline, live: (s: Step) => boolean): { step: Step | null; timeline: Timeline } {
  const undone = [...t.undone];
  while (undone.length && !live(undone[undone.length - 1])) undone.pop();
  return { step: undone[undone.length - 1] ?? null, timeline: { ...t, undone } };
}

/** `step` was undone: it moves to the redo side. Works for a fallback step not in `done`. */
export function undid(t: Timeline, step: Step): Timeline {
  const done = t.done[t.done.length - 1] === step ? t.done.slice(0, -1) : t.done;
  return { ...t, done, undone: [...t.undone, step] };
}

/** `step` was redone: back on the done side. */
export function redid(t: Timeline, step: Step): Timeline {
  const undone = t.undone[t.undone.length - 1] === step ? t.undone.slice(0, -1) : t.undone;
  return { ...t, undone, done: [...t.done, step] };
}

/**
 * A server change undone some other way (Chronicle › Changes names its batch; a toast's Undo
 * takes the latest): it leaves the done side. With `toRedo` it goes to the redo side, as a
 * toast's Undo does, so ⇧⌘Z puts it back.
 */
export function forget(t: Timeline, batch: string | null, { toRedo = false } = {}): Timeline {
  const matches = (s: Step) => s.kind === "server" && (batch === null || s.batch === batch);
  let i = t.done.length - 1;
  while (i >= 0 && !matches(t.done[i])) i--;
  if (i < 0) return t;
  const done = [...t.done.slice(0, i), ...t.done.slice(i + 1)];
  return { ...t, done, undone: toRedo ? [...t.undone, t.done[i]] : t.undone };
}
