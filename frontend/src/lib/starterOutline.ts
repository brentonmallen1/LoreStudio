import type { StoryStructureTemplate } from "../types";

type Template = Pick<StoryStructureTemplate, "levels" | "starter_outline" | "flat">;

/**
 * Where a new story's first outline opens for writing, in words: the twin of
 * `scaffold_story` (backend services/structure_scaffold.py). A flat template (Single MICE)
 * opens its first beat; any other opens one node at each level under its first top-level
 * part, and writing starts in the deepest.
 */
export function startsIn(template: Template): string {
  const first = template.starter_outline[0] ?? template.levels[0]?.name ?? "";
  if (template.flat) return `the ${first.toLowerCase()}`;
  if (template.levels.length < 2) return first;
  const leaf = template.levels[template.levels.length - 1].name.toLowerCase();
  return `a first ${leaf} in ${first}`;
}

/** New Story's "Start with an outline" hint: what is laid out, and where writing starts. */
export function outlineHint(template: Template): string {
  return `${template.starter_outline.join(" · ")}, with ${startsIn(template)} ready to write in. Rename, move or delete any of it.`;
}
