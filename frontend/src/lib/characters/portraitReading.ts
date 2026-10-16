import type { CharacterImageDescription } from "../../components/media/PortraitEditor";

/** The portrait reading as the model wrote it: JSON, sometimes in a fence. Null when it is not. */
export function readPortrait(text: unknown): CharacterImageDescription | null {
  if (typeof text !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(text.replace(/```(?:json)?\n?/g, "").trim());
    return parsed && typeof parsed === "object" ? (parsed as CharacterImageDescription) : null;
  } catch {
    return null;
  }
}
