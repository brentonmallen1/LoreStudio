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

/** Hues the slots are seeded from, in slot order, for mapping an imported hex to the nearest slot. */
const SLOT_HUES = [215, 15, 150, 270, 40, 330, 185, 210];

export function nearestSlot(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.12) return 8; // grey: the slate slot
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  let best = 1;
  let bestDist = 361;
  SLOT_HUES.forEach((hue, i) => {
    if (i === 7) return; // slate is for greys only
    const d = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
    if (d < bestDist) {
      bestDist = d;
      best = i + 1;
    }
  });
  return best;
}
