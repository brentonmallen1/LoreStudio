import type { KnowledgeScope } from "../../types";

/**
 * The four scopes an interview can be held in, and the words for them (doc 06 §6).
 *
 * One list, because two pickers offer these — the start dialog and the panel header — and
 * the wording is the whole point: "knows everything written so far" read as omniscience
 * when it only ever meant the scenes the character was in.
 */
export const FIXED_SCOPES: { value: KnowledgeScope; label: string; hint: string }[] = [
  {
    value: "profile",
    label: "Profile only — outside the story",
    hint: "They are themselves — history, voice, what they want — and know none of the plot.",
  },
  {
    value: "present",
    label: "Knows the scenes they're in",
    hint: "Every scene they appear in, across the manuscript. Not the ones they were absent from.",
  },
  {
    value: "omniscient",
    label: "Sees the whole manuscript — hypothetical",
    hint: "Shows them scenes they were never in, so you can ask how they would have handled them. They are told plainly which parts they did not live.",
  },
];

/** A picker value is either one of the fixed scopes or a scene id meaning "up to here". */
export function readPickerValue(value: string): { scope: KnowledgeScope; nodeId?: string } {
  const fixed = FIXED_SCOPES.find((s) => s.value === value);
  return fixed ? { scope: fixed.value } : { scope: "as_of", nodeId: value };
}

export function pickerValue(scope: KnowledgeScope, nodeId: string | null): string {
  return scope === "as_of" ? (nodeId ?? "") : scope;
}

export function scopeLabel(scope: KnowledgeScope, sceneTitle?: string | null): string {
  if (scope === "as_of") return `Knows up to ${sceneTitle ?? "this point"}`;
  return FIXED_SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

export function scopeHint(scope: KnowledgeScope): string {
  if (scope === "as_of") return "They know the story up to that scene, and nothing after it.";
  return FIXED_SCOPES.find((s) => s.value === scope)?.hint ?? "";
}
