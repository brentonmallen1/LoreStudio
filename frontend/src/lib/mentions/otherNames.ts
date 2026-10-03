/**
 * Fixing a mention that names nobody: which existing entry the words most likely mean.
 * "[[The Keeper's Cottage]]" is Keeper's Cottage; "@Nell" is nobody until the author says so.
 */

import { nameForms } from "../prose/syntax";

const ARTICLE = /^(the|a|an)\s+/;

/** Lowercase, straight quotes, no leading article, single spaces. */
export function normalName(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().replace(ARTICLE, "");
}

const words = (s: string) =>
  normalName(s)
    .split(/[^\p{L}\p{N}']+/u)
    .filter((w) => w.length > 2);

/** Edits (insert, delete, change, swap two neighbours) between two short strings. */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/** A slip of the keys: one edit in a short name, two in a longer one. */
const isTypo = (a: string, b: string) =>
  Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1);

/**
 * How likely `written` names `name`, by the name or any form prose uses for it ("Calder"
 * for "The Visitor (Calder)"): 3 the same once normalised, 2 one inside the other or a typo
 * away, 1 a word in common, 0 nothing.
 */
export function closeness(written: string, name: string): number {
  const a = normalName(written);
  const full = normalName(name);
  if (!a || !full) return 0;
  const forms = [...nameForms(name)].map(normalName).filter(Boolean);
  if (a === full || forms.includes(a)) return 3;
  // A form counts whole or misspelt, never as a fragment: "Lighthouse" is not every
  // "Lighthouse Steps".
  if (a.includes(full) || full.includes(a) || [full, ...forms].some((f) => isTypo(a, f))) return 2;
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
