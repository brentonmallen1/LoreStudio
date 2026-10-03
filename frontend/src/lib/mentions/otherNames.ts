/**
 * Fixing a mention that names nobody: which existing entry the words most likely mean.
 * "[[The Keeper's Cottage]]" is Keeper's Cottage; "@Nell" is nobody until the author says so.
 */

const ARTICLE = /^(the|a|an)\s+/;

/** Lowercase, straight quotes, no leading article, single spaces. */
export function normalName(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().replace(ARTICLE, "");
}

const words = (s: string) =>
  normalName(s)
    .split(/[^\p{L}\p{N}']+/u)
    .filter((w) => w.length > 2);

/**
 * How likely `written` names `name`: 3 the same once normalised, 2 one inside the other,
 * 1 a word in common, 0 nothing.
 */
export function closeness(written: string, name: string): number {
  const a = normalName(written);
  const b = normalName(name);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const theirs = new Set(words(name));
  return words(written).some((w) => theirs.has(w)) ? 1 : 0;
}

export interface Named {
  name: string;
  aliases?: string[];
}

/** Every entry, closest first (by its name or any other name), then by name. */
export function rankByName<T extends Named>(written: string, items: T[]): { item: T; score: number }[] {
  return items
    .map((item) => ({
      item,
      score: Math.max(...[item.name, ...(item.aliases ?? [])].map((n) => closeness(written, n))),
    }))
    .sort((x, y) => y.score - x.score || x.item.name.localeCompare(y.item.name));
}
