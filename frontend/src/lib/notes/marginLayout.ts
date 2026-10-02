/**
 * Where each note's card sits in the margin (doc 13 P2). Cards want to sit level with the
 * text they belong to; when two anchors are close, the later card moves down until it
 * clears the one above. The active card is the exception: it sits exactly at its anchor,
 * the cards below it move down and the cards above it move up to make room, the way a
 * document's comments behave.
 */
export interface MarginAnchor {
  id: string;
  /** The anchor's top, in the scroll area's content coordinates. */
  top: number;
}

export function layoutCards(
  anchors: MarginAnchor[],
  heights: Record<string, number>,
  gap: number,
  activeId: string | null = null,
  fallbackHeight = 48,
): Record<string, number> {
  const sorted = [...anchors].sort((a, b) => a.top - b.top);
  const h = (id: string) => heights[id] ?? fallbackHeight;
  const tops: Record<string, number> = {};
  const pivot = activeId ? sorted.findIndex((a) => a.id === activeId) : -1;

  if (pivot < 0) {
    let floor = -Infinity;
    for (const a of sorted) {
      tops[a.id] = Math.max(a.top, floor);
      floor = tops[a.id] + h(a.id) + gap;
    }
    return tops;
  }

  tops[sorted[pivot].id] = sorted[pivot].top;
  let floor = sorted[pivot].top + h(sorted[pivot].id) + gap;
  for (const a of sorted.slice(pivot + 1)) {
    tops[a.id] = Math.max(a.top, floor);
    floor = tops[a.id] + h(a.id) + gap;
  }
  let ceiling = sorted[pivot].top - gap;
  for (const a of sorted.slice(0, pivot).reverse()) {
    tops[a.id] = Math.min(a.top, ceiling - h(a.id));
    ceiling = tops[a.id] - gap;
  }
  return tops;
}
