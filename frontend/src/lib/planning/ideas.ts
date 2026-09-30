/** The brain dump (refactor doc 10 P2): pieces the author writes, then sorts into the story. */
import type { IdeaFragment } from "../../types/planning";
import { nameForms } from "./whoIsInScene";

/**
 * A paste becomes pieces: paragraphs when there are blank lines, otherwise one piece per
 * line. A list pasted from notes ("- the keeper", "* the storm") loses its bullets.
 */
export function splitIntoFragments(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const pieces = /\n\s*\n/.test(trimmed) ? trimmed.split(/\n\s*\n/) : trimmed.split("\n");
  return pieces.map((p) => p.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
}

export function newFragment(text: string, now: string, id: string): IdeaFragment {
  return { id, text, created_at: now, filed: null };
}

const NOT_NAMES = new Set([
  "I",
  "I'm",
  "I'd",
  "I'll",
  "The",
  "A",
  "An",
  "And",
  "But",
  "Or",
  "So",
  "Then",
  "When",
  "What",
  "Why",
  "Who",
  "Where",
  "How",
  "Maybe",
  "Perhaps",
  "She",
  "He",
  "They",
  "It",
  "We",
  "You",
  "His",
  "Her",
  "Their",
  "This",
  "That",
  "These",
  "Those",
  "There",
  "In",
  "On",
  "At",
  "If",
  "After",
  "Before",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Act",
  "Chapter",
  "Scene",
]);

/**
 * Capitalised words the story does not know yet, as possible characters or places:
 * "Calder turns up in the storm" suggests Calder. A capital that only starts a sentence
 * counts when the same word is capitalised elsewhere too. Deterministic, no AI.
 */
export function suggestNames(text: string, knownNames: string[]): string[] {
  const known = new Set(knownNames.flatMap(nameForms).map((n) => n.toLowerCase()));
  const found: string[] = [];
  const re = /(^|[.!?]\s+|[^\p{L}'’])(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){0,2})/gu;
  const midSentence = new Set<string>();
  const starts = new Set<string>();
  for (const m of text.matchAll(re)) {
    const atStart = m[1] === "" || /[.!?]\s+$/.test(m[1]);
    const words = m[2].split(/\s+/);
    // "the Grey Tower" is a name; "The" leading a sentence is not part of one.
    const name = words.filter((w, i) => !(i === 0 && NOT_NAMES.has(w))).join(" ");
    if (!name || NOT_NAMES.has(name)) continue;
    (atStart && words[0] === name.split(" ")[0] ? starts : midSentence).add(name);
  }
  for (const name of [...midSentence, ...starts]) {
    if (starts.has(name) && !midSentence.has(name)) continue;
    if (known.has(name.toLowerCase()) || found.includes(name)) continue;
    found.push(name);
  }
  return found;
}
