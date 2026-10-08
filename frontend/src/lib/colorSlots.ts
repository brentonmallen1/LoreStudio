/**
 * Palette slots (refactor doc 11, phase 2). A character, place or thread carries a slot
 * number, not a colour: every theme defines `--cat-1…8` in its own inks, contrast-tested,
 * so the same Eleanor is blue on Zen and blue on Nord without either being unreadable.
 * Slot 0 means "none chosen yet".
 */
export const SLOT_COUNT = 8;

export function slotVar(slot: number | null | undefined, fallback = "var(--color-text-subtle)"): string {
  return slot && slot >= 1 && slot <= SLOT_COUNT ? `var(--cat-${slot})` : fallback;
}

export function slotFgVar(slot: number | null | undefined, fallback = "var(--color-bg)"): string {
  return slot && slot >= 1 && slot <= SLOT_COUNT ? `var(--cat-${slot}-fg)` : fallback;
}

/** The least-used slot among what is taken, lowest number on a tie: new things stay distinct as long as they can. */
export function nextSlot(used: Iterable<number | null | undefined>): number {
  const counts = new Array<number>(SLOT_COUNT + 1).fill(0);
  for (const u of used) if (u && u >= 1 && u <= SLOT_COUNT) counts[u]++;
  let best = 1;
  for (let s = 2; s <= SLOT_COUNT; s++) if (counts[s] < counts[best]) best = s;
  return best;
}
