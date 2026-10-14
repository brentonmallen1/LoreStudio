import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import type { StoryFormat } from "../../types";
import type { HelperGroup, TypingHelper } from "./helpers";

/**
 * A typing helper as the guide, `?` and the slash menu write it (doc 26, P2): the ways to
 * reach it as this platform writes keys, and the groups the guide puts them in.
 */

/** "^"; "⌘⌥N" then "/note"; six element keys as one range, "⌥⌘1–6". */
export function ways(h: TypingHelper): string[] {
  const keys = (h.shortcuts ?? []).map((id) => formatCombo(SHORTCUTS[id].combo));
  const shown = keys.length > 2 ? [range(keys)] : keys;
  return [...shown, ...(h.typed ? [h.typed.trim() || h.typed] : [])];
}

/** Keys that differ only in their last character, as one range. */
function range(keys: string[]): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  const stem = first.slice(0, -1);
  return keys.every((k) => k.slice(0, -1) === stem) ? `${first}–${last.slice(-1)}` : keys.join(", ");
}

export const GROUP_TITLES: Record<HelperGroup, string> = {
  speech: "Giving someone a line",
  names: "Naming people and places",
  margin: "Notes in the margin",
  commands: "Commands",
  elements: "A script's elements",
};

export const GROUP_ORDER: HelperGroup[] = ["speech", "names", "margin", "commands", "elements"];

/** Where a helper works, when it is not everywhere: "In a script", "In a screenplay". */
export function whereNote(h: TypingHelper): string {
  const w = h.where;
  if (w.length === 3) return "";
  if (w.length === 2 && !w.includes("prose")) return "In a script";
  const names: Record<StoryFormat, string> = {
    prose: "prose",
    screenplay: "a screenplay",
    stage_play: "a play",
  };
  return `In ${w.map((f) => names[f]).join(" or ")}`;
}
