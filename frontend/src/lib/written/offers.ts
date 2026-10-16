/**
 * The words of What you've written's tidy-up offers (doc 29 D6), kept apart so they are tested.
 * Each offer says the rule it was found by (CLAUDE.md: an estimate says what it assumes).
 */

const COUNT = ["", "once", "twice", "three times", "four times", "five times"];

/** "The time jumps twice, at “By morning” and “Three days on”." */
export function jumpsLine(jumps: { phrase: string }[]): string {
  const phrases = jumps.map((j) => `“${j.phrase}”`);
  const n = phrases.length;
  if (n === 0) return "";
  const times = COUNT[n] ?? `${n} times`;
  const list = n === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} and ${phrases[n - 1]}`;
  return n === 1 ? `The time jumps at ${list}.` : `The time jumps ${times}, at ${list}.`;
}

/** The rule a long scene is found by, said where the offer shows. */
export function longRule(words: number): string {
  return `LoreStudio offers this for a scene of ${words.toLocaleString()} words or more where a paragraph opens on a jump in time, such as “By morning” or “Three days on”.`;
}

/** The rule a part with many scenes is found by. */
export function manyRule(scenes: number, level: string): string {
  return `LoreStudio offers this when one ${level} holds ${scenes} scenes or more.`;
}
