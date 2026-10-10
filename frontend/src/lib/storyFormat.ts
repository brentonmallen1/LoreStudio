import { useStoryStore } from "../stores/storyStore";
import type { Story, StoryFormat, StoryStructureTemplate } from "../types";

/**
 * What a story is written as (doc 25): prose, or a screenplay. Anything that behaves
 * differently for a script asks here; the backend's twin is services/story_format.py.
 */

export const FORMATS: { id: StoryFormat; label: string; hint: string }[] = [
  { id: "prose", label: "Prose", hint: "A novel, a short story: chapters and scenes of prose." },
  {
    id: "screenplay",
    label: "Screenplay",
    hint: "A film, a short or TV: scenes of action and dialogue, laid out as a script and counted in pages.",
  },
];

/** The structure a new story of this format starts with, unless the author picks another. */
export const DEFAULT_TEMPLATE: Record<StoryFormat, string> = {
  prose: "freeform",
  screenplay: "screenplay",
};

export function formatOf(story: Pick<Story, "story_format"> | null | undefined): StoryFormat {
  return story?.story_format === "screenplay" ? "screenplay" : "prose";
}

export function isScript(story: Pick<Story, "story_format"> | null | undefined): boolean {
  return formatOf(story) !== "prose";
}

/** The format of the story open now. */
export function useStoryFormat(): StoryFormat {
  return useStoryStore((s) => formatOf(s.activeStory));
}

/**
 * The structures to offer a story of this format: the ones written for it first, then the
 * ones that fit any format. A structure written for another format is left out.
 */
export function templatesFor(
  templates: StoryStructureTemplate[],
  format: StoryFormat,
): StoryStructureTemplate[] {
  const own = templates.filter((t) => t.format === format);
  const any = templates.filter((t) => !t.format);
  return [...own, ...any];
}

/** Script files the import wizard opens as a screenplay (doc 25, P6): the server's
 *  `import_script.SCRIPT_EXTENSIONS`. */
export const SCRIPT_FILES = [".fountain", ".spmd", ".fdx"];

export function isScriptFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SCRIPT_FILES.some((ext) => lower.endsWith(ext));
}

/** Whether an import came from a script file, by the format the server read it as. */
export function isScriptImport(sourceFormat: string): boolean {
  return sourceFormat === "fountain" || sourceFormat === "fdx";
}
