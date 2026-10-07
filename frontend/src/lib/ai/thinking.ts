import { AI_FEATURES_BY_ID } from "./features.generated";

/** Settings › Model parameters: when Gemma reasons before answering. */
export type ThinkingMode = "off" | "helps" | "always";

export const THINKING_MODES: { value: ThinkingMode; label: string }[] = [
  { value: "helps", label: "Where it helps" },
  { value: "always", label: "Always" },
  { value: "off", label: "Off" },
];

/** Whether a call to this feature thinks under this choice: the server's rule, for showing it. */
export function thinksFor(featureId: string | undefined, mode: ThinkingMode | undefined): boolean {
  if (mode === "off" || mode === "always") return mode === "always";
  return !!(featureId && AI_FEATURES_BY_ID[featureId]?.thinks);
}
