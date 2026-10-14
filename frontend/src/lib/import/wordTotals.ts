/** Word counts on the import's Structure step. A node's own count is only the text between its
 * heading and the next one, so an act whose text all sits in its scenes reads as nothing; a row
 * shows its total instead, its own words and everything inside it. */
export function wordTotals(nodes: { id: string; parent_id: string | null; word_count: number }[]) {
  const kids = new Map<string, string[]>();
  for (const n of nodes) if (n.parent_id) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n.id]);
  const own = new Map(nodes.map((n) => [n.id, n.word_count]));
  const totals = new Map<string, number>();
  const total = (id: string): number => {
    const known = totals.get(id);
    if (known !== undefined) return known;
    const sum = (own.get(id) ?? 0) + (kids.get(id) ?? []).reduce((s, k) => s + total(k), 0);
    totals.set(id, sum);
    return sum;
  };
  for (const n of nodes) total(n.id);
  return totals;
}

export function wordsLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "word" : "words"}`;
}
