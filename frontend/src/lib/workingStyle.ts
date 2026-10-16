import type { StructureNode, StoryStructureTemplate, WorkingStyle } from "../types";
import { sceneLeaves } from "./planning/methods";

/**
 * How the writer likes to work (doc 29 D1). New Story asks once and the story keeps it; Story
 * identity changes it. It decides where a new story opens and the Overview's next step,
 * never what is available.
 */
export const WORKING_STYLES: { id: Exclude<WorkingStyle, "">; label: string; hint: string; says: string }[] =
  [
    {
      id: "plan",
      label: "I like to plan first",
      hint: "Start in the Outline: jot down what happens, scene by scene, then write. A few guided questions can help you fill it.",
      says: "You like to plan first",
    },
    {
      id: "discover",
      label: "I find the story as I write",
      hint: "Start on a blank page. As you write, LoreStudio keeps your scenes in order and shows their shape in the Outline.",
      says: "You find the story as you write",
    },
    {
      id: "both",
      label: "A bit of both, or not sure yet",
      hint: "Start on the story's overview, with both ways one click away.",
      says: "A bit of both",
    },
  ];

export const NO_RIGHT_ANSWER =
  "There's no right answer. This only changes where you start and what LoreStudio offers first; every tool stays available.";

/** The style as the story keeps it: anything unknown is "" (an older story, or none chosen). */
export function styleOf(story: { working_style?: string | null } | null | undefined): WorkingStyle {
  const s = story?.working_style;
  return s === "plan" || s === "discover" || s === "both" ? s : "";
}

/**
 * Where a new story opens: a planner in the Outline, a discovery writer in the first scene,
 * and anyone else on the Overview. The First story guide, when chosen, comes before all three.
 */
export function landingPath(
  storyId: string,
  style: WorkingStyle,
  startNodeId: string | null | undefined,
  firstStory = false,
): string {
  const home = `/stories/${storyId}`;
  if (firstStory) return `${home}/first-story`;
  if (style === "plan") return `${home}/outline`;
  if (style === "discover") return startNodeId ? `${home}/write?node=${startNodeId}` : `${home}/write`;
  return home;
}

export type NextStep =
  | { kind: "write-planned"; scene: StructureNode; planned: number }
  | { kind: "keep-going"; scene: StructureNode }
  | null;

/**
 * The Overview's next step (doc 29 D8), by how the writer works:
 * - a planner is offered the first scene in the Outline with no words yet, and how many
 *   such scenes wait;
 * - a discovery writer is offered the scene they wrote in last (`lastId`, the Overview's most
 *   recent scene), or else the last scene with words;
 * - "both" and an older story keep the Overview as it was (null).
 */
export function nextStep(
  structure: StructureNode[],
  template: Pick<StoryStructureTemplate, "levels" | "flat"> | null,
  style: WorkingStyle,
  lastId?: string | null,
): NextStep {
  const scenes = sceneLeaves(structure, template);
  if (style === "plan") {
    const unwritten = scenes.filter((s) => !s.word_count);
    return unwritten.length
      ? { kind: "write-planned", scene: unwritten[0], planned: unwritten.length }
      : null;
  }
  if (style === "discover") {
    const last = scenes.find((s) => s.id === lastId) ?? [...scenes].reverse().find((s) => s.word_count > 0);
    return last ? { kind: "keep-going", scene: last } : null;
  }
  return null;
}

/** "Your Outline has 4 planned scenes with no words yet. “The Gap” is the first: …" */
export function plannedLine(planned: number, title: string, synopsis: string): string {
  const what = synopsis.trim();
  if (planned === 1)
    return what
      ? `One planned scene in your Outline has no words yet: ${what}`
      : "One planned scene in your Outline has no words yet.";
  const lead = `Your Outline has ${planned} planned scenes with no words yet. “${title}” is the first`;
  return what ? `${lead}: ${what}` : `${lead}.`;
}
