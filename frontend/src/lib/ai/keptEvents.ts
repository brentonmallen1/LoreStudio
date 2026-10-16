import type { SubjectType } from "../../api/assistantResults";

/** A thing a kept answer is about (A6, A7). */
export interface KeptKey {
  storyId: string;
  type: SubjectType;
  id: string;
}

const EVENT = "lorestudio:kept-answer";

export function keptKeyOf(k: KeptKey): string {
  return `${k.storyId}|${k.type}|${k.id}`;
}

/**
 * Say that the server kept a new answer about a thing, so every place showing that thing's
 * answers reads them again: a portrait read from the sheet's portrait shows in the sheet's
 * band, an arc summary asked on Story identity shows on the character's sheet beside it.
 */
export function announceKept(k: KeptKey): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: keptKeyOf(k) }));
}

/** Listen for `announceKept`; returns the unsubscribe. */
export function onKept(listener: (key: string) => void): () => void {
  const handle = (e: Event) => listener((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}
