import { useStoryStore } from "../stores/storyStore";
import type { Story, StoryFormat, StoryStructureTemplate } from "../types";

/**
 * What a story is written as (doc 25): prose, a screenplay, or a stage play. A screenplay and a
 * play are both scripts, written in the same elements and laid out differently. Anything that
 * behaves differently for a script asks here; the backend's twin is services/story_format.py.
 */

export const FORMATS: { id: StoryFormat; label: string; hint: string }[] = [
  { id: "prose", label: "Prose", hint: "A novel, a short story: chapters and scenes of prose." },
  {
    id: "screenplay",
    label: "Screenplay",
    hint: "A film, a short or TV: scenes of action and dialogue, laid out as a script and counted in pages.",
  },
  {
    id: "stage_play",
    label: "Stage play",
    hint: "A play for the theatre: acts and scenes of speeches and stage directions, laid out as a play and counted in pages.",
  },
];

/** A format's name, as a story card or a heading says it. */
export function formatLabel(format: StoryFormat): string {
  return FORMATS.find((f) => f.id === format)?.label ?? "Prose";
}

/** The structure a new story of this format starts with, unless the author picks another. */
export const DEFAULT_TEMPLATE: Record<StoryFormat, string> = {
  prose: "freeform",
  screenplay: "screenplay",
  stage_play: "stage-play",
};

export function formatOf(story: Pick<Story, "story_format"> | null | undefined): StoryFormat {
  const format = story?.story_format;
  return format === "screenplay" || format === "stage_play" ? format : "prose";
}

export function isScript(story: Pick<Story, "story_format"> | null | undefined): boolean {
  return formatOf(story) !== "prose";
}

/**
 * How long a script runs, at a minute a page (doc 25, P11): "about 1 hour 52 minutes on screen,
 * at a minute a page". A figure built on a rule of thumb names the rule where it is shown, so
 * the rule is part of the phrase; `runningTimeRule` says how far to trust it.
 */
export function runningTime(pages: number, format: StoryFormat = "screenplay"): string {
  const where = format === "stage_play" ? "on stage" : "on screen";
  return `about ${duration(pages)} ${where}, at a minute a page`;
}

/** "1 hour 52 minutes", "a minute". */
function duration(minutes: number): string {
  if (minutes <= 1) return "a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    rest ? `${rest} ${rest === 1 ? "minute" : "minutes"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The words a minute `readingTime` assumes: the middle of an adult's 200 to 300. */
export const READING_WPM = 250;

/** How long prose takes to read: "about 4 hours 20 minutes to read, at 250 words a minute". */
export function readingTime(words: number): string {
  return `about ${duration(Math.ceil(words / READING_WPM))} to read, at ${READING_WPM} words a minute`;
}

export const READING_RULE = "Most adults read 200 to 300 words a minute; 250 is the middle.";

/** What the minute a page leaves out, for the reader of a running time. */
export function runningTimeRule(format: StoryFormat = "screenplay"): string {
  return format === "stage_play"
    ? "A minute a page is only a rough guide for a play: pauses, business and the production's pace move it either way."
    : "A minute a page is the rule of thumb for a screenplay: quick dialogue plays faster, and a line of action can take a minute to play.";
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
