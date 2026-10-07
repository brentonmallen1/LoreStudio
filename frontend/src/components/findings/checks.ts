/**
 * The Assistant checks the Run checks menu offers (doc 12 P4). Each runs as a `check` job
 * (doc 21, routers/checks.py) and logs its run; the findings feed reads the newest run back,
 * so running a check is all it takes for its findings to appear. Ids are `AI_FEATURES` ids.
 */
export interface AssistantCheck {
  id: string;
  label: string;
  hint: string;
}

/** The local checks, in a line each: what they look for (services/findings/local.py, data.py). */
export const LOCAL_CHECKS = {
  always: {
    label: "Names, speakers, cast, threads, chapters",
    hint: "Names that drift from the Lorebook, speakers it does not know, characters and threads gone quiet, chapter and length checks",
  },
  prose: {
    label: "Prose habits, tense, point of view",
    hint: "Passive voice, adverbs, tags other than said, repeated words, slips of tense and point of view",
  },
};

export const ASSISTANT_CHECKS: AssistantCheck[] = [
  {
    id: "pacing-analysis",
    label: "Pacing",
    hint: "Where it drags, where it rushes",
  },
  {
    id: "plot-holes",
    label: "Plot holes",
    hint: "Logic gaps and questions left open",
  },
  {
    id: "continuity-check",
    label: "Continuity",
    hint: "What a character knows, the timeline, details",
  },
  {
    id: "character-dimensionality",
    label: "Character depth",
    hint: "Who reads flat so far",
  },
  {
    id: "theme-tracker",
    label: "Themes",
    hint: "What is set up and dropped",
  },
  {
    id: "cliche-analysis",
    label: "Clichés",
    hint: "Worn phrases, tropes, devices",
  },
  {
    id: "first-pass",
    label: "First-pass editor",
    hint: "The prose against what you said you meant",
  },
  {
    id: "essential-questions",
    label: "Story compass",
    hint: "Who, wants what, why, against what",
  },
  {
    id: "economy-analysis",
    label: "Story economy",
    hint: "Threads and scenes for the length you chose",
  },
];
