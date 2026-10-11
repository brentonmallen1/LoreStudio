import { elementLabel, ENTER_NEXT, SHIFT_TAB_NEXT, TAB_NEXT, type ScriptElement } from "./syntax";

/**
 * What the script editor says about the line being written (doc 25, P3½), for writers new to
 * the format: an empty line's hint ("Who speaks, in capitals · Tab for transition") and the keys
 * card in the status corner. Read from the same Enter and Tab tables the keys follow, so the
 * words cannot drift from what the keys do.
 */
const WHAT: Record<ScriptElement, string> = {
  heading: "INT. or EXT., the place, and when",
  action: "What we see happen",
  cue: "Who speaks, in capitals",
  paren: "How the line is said",
  dialogue: "What they say",
  transition: "CUT TO:, FADE OUT. and the like",
  centered: "A centred line",
  lyric: "Words sung",
};

const STAGE_WHAT: Partial<Record<ScriptElement, string>> = {
  heading: "SCENE 1, or ACT TWO above an act's first scene",
  action: "What the audience sees happen",
};

const lower = (el: ScriptElement, fmt: string) => elementLabel(el, fmt).toLowerCase();

/** An empty line's hint, at its own indent. */
export function lineHint(el: ScriptElement, fmt: string): string {
  const what = (fmt === "stage_play" && STAGE_WHAT[el]) || WHAT[el];
  return `${what} · Tab for ${lower(TAB_NEXT[el], fmt)}`;
}

/** The keys from a line of this element, and what each does there. */
export function keysFrom(el: ScriptElement, fmt: string): [string, string][] {
  const name = (e: ScriptElement) => elementLabel(e, fmt);
  return [
    ["Enter", `next line: ${lower(ENTER_NEXT[el], fmt)}`],
    ["Enter, line empty", el === "action" ? "another line" : `switch it to ${lower("action", fmt)}`],
    ["Tab", `switch this line to ${name(TAB_NEXT[el]).toLowerCase()}`],
    ["Shift-Tab", `switch it to ${name(SHIFT_TAB_NEXT[el]).toLowerCase()}`],
    ["^", "a line of dialogue: pick who speaks, then type it"],
    ["/", "every element and command by name"],
  ];
}
