/**
 * Interface size (doc 17, D1–D2): one factor that scales the chrome (text, spacing, icons,
 * controls) through the root font size, leaving the prose at the size the writer chose.
 *
 * The root is 15px at Default. Everything sized in rem follows it; icons follow through
 * `svg.lucide { zoom }` in index.css. The prose size is set in px from the same 15px base so
 * it never moves with the interface.
 */
export type UiScale = "small" | "default" | "large" | "larger";

export const ROOT_PX = 15;

export const UI_SCALES: { value: UiScale; label: string; factor: number }[] = [
  { value: "small", label: "Small", factor: 0.9 },
  { value: "default", label: "Default", factor: 1 },
  { value: "large", label: "Large", factor: 1.1 },
  { value: "larger", label: "Larger", factor: 1.25 },
];

export function isUiScale(v: unknown): v is UiScale {
  return UI_SCALES.some((s) => s.value === v);
}

export function scaleFactor(scale: UiScale): number {
  return UI_SCALES.find((s) => s.value === scale)?.factor ?? 1;
}

/** The next size up (+1) or down (-1), stopping at the ends. */
export function stepScale(scale: UiScale, dir: 1 | -1): UiScale {
  const i = UI_SCALES.findIndex((s) => s.value === scale);
  const next = Math.min(UI_SCALES.length - 1, Math.max(0, i + dir));
  return UI_SCALES[next].value;
}

/** A px measure in the chrome at the current interface size (for JS layout arithmetic). */
export function scaledPx(px: number, scale: UiScale): number {
  return Math.round(px * scaleFactor(scale));
}
