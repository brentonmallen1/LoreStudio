import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import type { StoryFormat } from "../../types";
import { helper, type HelperId, type TypingHelper } from "./helpers";

/**
 * Tips while writing (doc 26, P4): when the writer does something the long way, one line by
 * the status corner names the short way. These are the pure parts: what a tip says, what
 * counts as the long way in the text, and the hint the empty scene's placeholder carries.
 * The rules (two a session, at a pause, never for a helper already used) are in
 * stores/tipStore.ts.
 */

/** Keys you press rather than characters you type. */
const PRESSED = /^(Tab|Enter)$/;

/** "Quicker than ⋯ › Insert image: type /image." */
export function tipLine(h: TypingHelper): string {
  const keys = (h.shortcuts ?? []).map((id) => `press ${formatCombo(SHORTCUTS[id].combo)}`);
  const typed = h.typed ? [PRESSED.test(h.typed) ? `press ${h.typed}` : `type ${h.typed.trim()}`] : [];
  return `Quicker than ${h.longWay}: ${[...keys, ...typed].join(", or ")}.`;
}

/** Words that say who spoke, written after a quote. */
const SAID =
  "said|says|asked|asks|replied|answered|whispered|shouted|called|cried|murmured|muttered|snapped|added";

/**
 * A quote in prose with its speaker written by hand after it: `"Run," Eleanor said.` or
 * `"Run," said Eleanor.` A line `^` wrote carries its speaker as `<Eleanor>` instead.
 */
const HAND_TAG = new RegExp(
  `[”"]\\s+(?:[A-Z][\\w'’-]*(?:\\s[A-Z][\\w'’-]*)?\\s(?:${SAID})\\b|(?:${SAID})\\s[A-Z])`,
);

export function tagsByHand(paragraph: string): boolean {
  return HAND_TAG.test(paragraph);
}

/**
 * The text before the cursor ends with one of these names and the character after it, so the
 * name was just typed out in full: "…and Eleanor " or "…to Eleanor,".
 */
export function namedByHand(before: string, names: readonly string[]): boolean {
  const end = /[\s.,;:!?…”’)—]$/.exec(before);
  if (!end) return false;
  const words = before.slice(0, -1);
  return names.some(
    (name) =>
      name.length >= 3 &&
      words.endsWith(name) &&
      !/[\p{L}\p{N}@]/u.test(words.charAt(words.length - name.length - 1)),
  );
}

/** What the empty scene's placeholder names, the first of these not yet used. */
const PLACEHOLDER_HINTS: [HelperId, string][] = [
  ["line", "^ gives someone a line"],
  ["mention", "@ names a character"],
  ["slash", "/ lists everything you can add"],
];

/** "Begin writing… · ^ gives someone a line": the placeholder, with a hint while tips are on. */
export function placeholderFor(format: StoryFormat, used: ReadonlySet<HelperId>, tips: boolean): string {
  const hint = tips ? PLACEHOLDER_HINTS.find(([id]) => !used.has(id))?.[1] : undefined;
  if (format === "prose") return hint ? `Begin writing… · ${hint}` : "Begin writing…";
  const base = format === "stage_play" ? "Write what the audience sees." : "Write what we see.";
  return hint ? `${base} ${hint}.` : base;
}

/** The helper a tip is about, with its line. */
export function tipFor(id: HelperId): { helper: TypingHelper; line: string } {
  const h = helper(id);
  return { helper: h, line: tipLine(h) };
}
