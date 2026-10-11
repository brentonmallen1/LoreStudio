import type { ScriptElement } from "./syntax";

/**
 * Completing a script's set words as they are typed (doc 25, P3½), as Final Draft's SmartType
 * does: a heading's INT. or EXT., its place from the Lorebook and its time of day; a
 * transition; a cue's extension. Returns the rest of the top match, shown faintly after the
 * cursor; Tab takes it. Names of who speaks are the cue picker's (lib/prose/completion.ts).
 * Pure, so the rules are tested apart from the editor (smartType.test.ts).
 */

const PREFIXES = ["INT. ", "EXT. ", "INT./EXT. ", "EST. "];
const TIMES = [
  "DAY",
  "NIGHT",
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "DUSK",
  "DAWN",
  "LATER",
  "CONTINUOUS",
  "MOMENTS LATER",
  "SAME TIME",
];
const TRANSITIONS = [
  "CUT TO:",
  "FADE OUT.",
  "FADE IN:",
  "DISSOLVE TO:",
  "SMASH CUT TO:",
  "MATCH CUT TO:",
  "FADE TO BLACK.",
  "INTERCUT WITH:",
  "BACK TO:",
  "TIME CUT:",
];
const STAGE_TRANSITIONS = ["BLACKOUT.", "LIGHTS FADE.", "LIGHTS UP.", "CURTAIN.", "END OF SCENE."];
const STAGE_MARKERS = ["SCENE ", "ACT "];
const EXTENSIONS = ["V.O.)", "O.S.)", "O.C.)", "CONT'D)"];

/** The rest of the first of `words` that `typed` begins, if `typed` is not all of it. */
function rest(typed: string, words: string[]): string {
  if (!typed) return "";
  const t = typed.toUpperCase();
  const hit = words.find((w) => w.toUpperCase().startsWith(t) && w.length > t.length);
  return hit ? hit.slice(t.length) : "";
}

/**
 * What to offer after `before`, the line's text up to the cursor, in a line of `el`. `places`
 * are the Lorebook's place names. Empty when there is nothing to offer.
 */
export function smartComplete(
  el: ScriptElement,
  before: string,
  format: string,
  places: string[] = [],
): string {
  if (el === "heading") {
    if (format === "stage_play") return rest(before, STAGE_MARKERS);
    // The time, after the place and " - ".
    const dash = before.lastIndexOf(" - ");
    if (dash >= 0) return rest(before.slice(dash + 3), TIMES);
    const prefix = PREFIXES.find((p) => before.toUpperCase().startsWith(p));
    if (!prefix) return /^[A-Za-z./]*$/.test(before) ? rest(before, PREFIXES) : "";
    const place = before.slice(prefix.length);
    // The shortest first: "THE LIGHTHOUSE" before "THE LIGHTHOUSE, LAMP ROOM", which typing on reaches.
    const names = places
      .map((p) => p.toUpperCase())
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    return rest(place, names);
  }
  if (el === "transition") return rest(before, format === "stage_play" ? STAGE_TRANSITIONS : TRANSITIONS);
  if (el === "cue") {
    const open = before.lastIndexOf("(");
    return open > 0 && !before.includes(")", open) ? rest(before.slice(open + 1), EXTENSIONS) : "";
  }
  return "";
}
