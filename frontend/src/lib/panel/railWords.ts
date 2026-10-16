import type { ToolId } from "../../types/panel";
import { TOOL_LABELS } from "../../types/panel";

/**
 * What each button on the side panel's rail opens, in a line (doc 30 D8). The rail is icons
 * by design, so these words are its tooltips (on hover and on keyboard focus) and the
 * labels of its one-time tour (`components/panel/RailTour`).
 */
export const TOOL_LINES: Record<ToolId, string> = {
  characters: "who is in your story",
  places: "where it happens",
  threads: "the questions your story keeps open",
  notes: "your margin notes and to-dos",
  dialogue: "who says what in this scene",
  novel: "the scene this one adapts",
};

export function toolLine(tool: ToolId): string {
  return `${TOOL_LABELS[tool]}: ${TOOL_LINES[tool]}`;
}

export const SCENE_LINE = "at a glance";
export const FREEWRITE_LINE = "Freewrite: loose writing, in a tab";
export const ASSISTANT_LINE = "Assistant: ask about your story";

/** The tour is shown once, then remembered on the account. */
export const RAIL_TOUR_PREF = "ls_rail_tour" as const;

/** Sent by the palette's "Show what the side panel's buttons do" to show the tour again. */
export const RAIL_TOUR_EVENT = "ls:rail-tour";

export function railTourSeen(): boolean {
  try {
    return localStorage.getItem(RAIL_TOUR_PREF) === "seen";
  } catch {
    return true; // site data blocked: never nag about it
  }
}
