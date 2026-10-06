/**
 * The geometry of Over time (doc 19 P6): where a reading sits along the time axis, where a
 * value sits in its own line's range, and which row a version's name takes so two names
 * close together do not overlap. Positions are percentages of the plot.
 */

/** Left to right in percent, by when each moment was. One moment alone sits at the end. */
export function timeX(t: number, start: number, end: number): number {
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
}

/** Top to bottom in percent within a line's own range, kept off the edges. Flat sits mid-row. */
export function valueY(v: number, lo: number, hi: number, inset = 14): number {
  if (hi <= lo) return 50;
  return inset + (1 - (v - lo) / (hi - lo)) * (100 - 2 * inset);
}

/** The edges of each reading's hover strip: halfway to its neighbours, the first from 0, the last to `last`. */
export function strips(xs: number[], last = 100): { from: number; to: number }[] {
  return xs.map((x, i) => ({
    from: i === 0 ? 0 : (xs[i - 1] + x) / 2,
    to: i === xs.length - 1 ? last : (x + xs[i + 1]) / 2,
  }));
}

/**
 * A row for each label, left to right: the first row with room, so names close together stack.
 * `x` is in percent, `w` the label's width and `plot` the plot's width, both in pixels.
 */
export function labelRows(labels: { x: number; w: number }[], plot: number, gap = 10): number[] {
  const ends: number[] = [];
  return labels.map(({ x, w }) => {
    const at = (x / 100) * plot;
    const side = anchor(x);
    const left = side === "start" ? at : side === "end" ? at - w : at - w / 2;
    let row = ends.findIndex((end) => left >= end + gap);
    if (row === -1) row = ends.length;
    ends[row] = left + w;
    return row;
  });
}

/** How a label sits on its rule: from it near the left edge, up to it near the right, else centred. */
export function anchor(x: number): "start" | "middle" | "end" {
  if (x < 18) return "start";
  if (x > 82) return "end";
  return "middle";
}
