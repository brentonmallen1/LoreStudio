/**
 * Whether ⌘Z in a text field belongs to the field or to the story (doc 23 P5b).
 *
 * A field you have typed in since you clicked into it keeps the browser's own undo, as every
 * text field does. One you have not (focus left in it after a save, or a search box you only
 * clicked) has nothing of yours to undo, and ⌘Z there used to do nothing at all: it goes to
 * the story's timeline instead. Values the page sets (a reload after undo) are not typing.
 */
const typedIn = new WeakSet<EventTarget>();

if (typeof document !== "undefined") {
  document.addEventListener("focusin", (e) => e.target && typedIn.delete(e.target), true);
  document.addEventListener("input", (e) => e.target && typedIn.add(e.target), true);
}

export function isUntouchedField(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA")) return false;
  return !typedIn.has(t);
}
