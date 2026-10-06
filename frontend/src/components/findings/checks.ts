import { api } from "../../api/client";

/**
 * The Assistant checks the Run checks menu offers (doc 12 P4), each with the call that
 * runs it. Every one logs its run; the findings feed reads the newest run back, so running
 * a check is all it takes for its findings to appear. Ids are `AI_FEATURES` ids.
 */
export interface AssistantCheck {
  id: string;
  label: string;
  hint: string;
  run: (storyId: string, signal: AbortSignal) => Promise<unknown>;
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
    run: (id, signal) => api.analyzePacing(id, signal),
  },
  {
    id: "plot-holes",
    label: "Plot holes",
    hint: "Logic gaps and questions left open",
    run: (id, signal) => api.analyzePlotHoles(id, signal),
  },
  {
    id: "continuity-check",
    label: "Continuity",
    hint: "What a character knows, the timeline, details",
    run: (id, signal) => api.analyzeContinuity(id, signal),
  },
  {
    id: "character-dimensionality",
    label: "Character depth",
    hint: "Who reads flat so far",
    run: (id, signal) => api.analyzeCharacterDimensionality(id, signal),
  },
  {
    id: "theme-tracker",
    label: "Themes",
    hint: "What is set up and dropped",
    run: (id, signal) => api.analyzeThemes(id, signal),
  },
  {
    id: "cliche-analysis",
    label: "Clichés",
    hint: "Worn phrases, tropes, devices",
    run: (id, signal) => api.analyzeCliches(id, signal),
  },
  {
    id: "first-pass",
    label: "First-pass editor",
    hint: "The prose against what you said you meant",
    run: (id, signal) => api.analyzeFirstPass(id, signal),
  },
  {
    id: "essential-questions",
    label: "Story compass",
    hint: "Who, wants what, why, against what",
    run: (id, signal) => api.analyzeEssentialQuestions(id, undefined, signal),
  },
  {
    id: "economy-analysis",
    label: "Story economy",
    hint: "Threads and scenes for the length you chose",
    run: (id, signal) => api.analyzeEconomy(id, signal),
  },
];
