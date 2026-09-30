/**
 * Planning methods, as data (refactor doc 10). Every method is a route through the same
 * fields — the logline, the paragraph summary, the synopsis, each character's goal,
 * motivation, conflict and epiphany, and the scene list — so switching methods loses
 * nothing, and anything planned shows up wherever those fields do.
 *
 * Adding a method is adding an entry here; the Plan page, the Overview's next step and
 * Story Health all read this list.
 */
import type { Character, Story, StoryStructureTemplate, StructureNode } from "../../types";

export type StoryPlanField = "logline" | "premise" | "central_conflict" | "paragraph_summary" | "synopsis";
export type CharacterPlanField =
  "mission_statement" | "motivation" | "conflict" | "epiphany" | "arc_in_own_words";

export type PlanTarget =
  | { kind: "story"; field: StoryPlanField }
  | { kind: "characters"; fields: CharacterPlanField[] }
  | { kind: "scenes" };

export interface PlanStep {
  id: string;
  label: string;
  /** One line: what the step is for. */
  why: string;
  /** How to write it. */
  how: string;
  /** From The Last Lighthouse. */
  example: string;
  target: PlanTarget;
  /** A story field shown above the editor as the thing this step grows from. */
  buildsOn?: StoryPlanField;
  /** Snowflake guidance layer for the AI (Studio mode only). */
  guidanceLayer?: string;
  /** Height of the text box for a story field. */
  rows?: number;
}

export interface PlanMethod {
  id: string;
  label: string;
  summary: string;
  steps: PlanStep[];
}

const CHARACTER_CORE: CharacterPlanField[] = ["mission_statement", "motivation", "conflict", "epiphany"];

export const CHARACTER_FIELD_LABELS: Record<CharacterPlanField, { label: string; placeholder: string }> = {
  mission_statement: { label: "Goal", placeholder: "What they want, in one sentence…" },
  motivation: { label: "Motivation", placeholder: "Why they want it…" },
  conflict: { label: "Conflict", placeholder: "What stands between them and what they want…" },
  epiphany: { label: "Epiphany", placeholder: "What they learn by the end, or refuse to…" },
  arc_in_own_words: { label: "In their own words", placeholder: "I came back to the island because…" },
};

const SCENE_LIST: PlanStep = {
  id: "scenes",
  label: "Scene list",
  why: "The plan becomes the book: every line here is a scene you can open and write.",
  how: "One line per scene: what happens in it. Add them in reading order; you can rearrange later.",
  example: "Eleanor notices six months of entries missing. The Visitor is not surprised.",
  target: { kind: "scenes" },
};

export const PLAN_METHODS: PlanMethod[] = [
  {
    id: "essentials",
    label: "The essentials",
    summary: "Four questions: what it is, what's at stake, who wants what, and what happens.",
    steps: [
      {
        id: "logline",
        label: "The story in one sentence",
        why: "A sentence you can hold in your head while you write.",
        how: "Who, what they want, what stands in the way. Around 25 words.",
        example:
          "When a mysterious historian arrives in a storm, a reclusive lighthouse keeper must choose between guarding her secrets and facing what she's buried.",
        target: { kind: "story", field: "logline" },
        rows: 2,
      },
      {
        id: "conflict",
        label: "The central conflict",
        why: "The pressure that drives every scene.",
        how: "What two things pull against each other? Name both sides.",
        example:
          "Eleanor's need to protect her carefully constructed isolation versus the truth that threatens to break it open.",
        target: { kind: "story", field: "central_conflict" },
        rows: 3,
      },
      {
        id: "characters",
        label: "Who wants what",
        why: "Characters who want things make scenes that move.",
        how: "For each main character: their goal, why they want it, what stands in the way, and what they learn.",
        example:
          "Goal: to learn the truth about her brother's death. Conflict: the keeper is hiding something.",
        target: { kind: "characters", fields: CHARACTER_CORE },
      },
      SCENE_LIST,
    ],
  },
  {
    id: "snowflake",
    label: "Snowflake Method",
    summary: "Grow the story outward from one sentence: a paragraph, then a page, then scenes.",
    steps: [
      {
        id: "sentence",
        label: "One-sentence summary",
        why: "The core of the story, before any detail.",
        how: "Around 25 words. Use roles rather than names; hint at the conflict and what makes it unusual.",
        example:
          "A reclusive lighthouse keeper must choose between protecting her buried past or telling the truth when a stranger arrives seeking answers.",
        target: { kind: "story", field: "logline" },
        guidanceLayer: "sentence",
        rows: 2,
      },
      {
        id: "paragraph",
        label: "One-paragraph summary",
        why: "The shape of the whole story: the start, three disasters, the end.",
        how: "Five sentences: the protagonist in their world, the first disaster, the second, the third, and how it ends.",
        example: "Eleanor Vance has kept the Last Lighthouse on Harrow Island alone for five years…",
        target: { kind: "story", field: "paragraph_summary" },
        buildsOn: "logline",
        guidanceLayer: "paragraph",
        rows: 6,
      },
      {
        id: "character-summaries",
        label: "Character summaries",
        why: "Each main character's own story line, before you weave them together.",
        how: "Goal, motivation, conflict and epiphany for each main character.",
        example:
          "Epiphany: she has been confusing loyalty with silence, and the kindest thing is to let the truth surface.",
        target: { kind: "characters", fields: CHARACTER_CORE },
        guidanceLayer: "character_summary",
      },
      {
        id: "synopsis",
        label: "One-page synopsis",
        why: "Enough detail to see cause and effect from beginning to end.",
        how: "Grow each sentence of your paragraph into a paragraph of its own.",
        example: "Eleanor Vance has kept the lighthouse running on Harrow Island for five years since…",
        target: { kind: "story", field: "synopsis" },
        buildsOn: "paragraph_summary",
        guidanceLayer: "synopsis",
        rows: 14,
      },
      {
        id: "character-synopses",
        label: "Character synopses",
        why: "Hearing each character tell it keeps them from becoming plot devices.",
        how: "Each main character's whole arc, in first person: where they began, what happened, where they ended.",
        example: "I came back to Harrow Island because my father was dying and there was no one else…",
        target: { kind: "characters", fields: ["arc_in_own_words"] },
        guidanceLayer: "character_synopsis",
      },
      SCENE_LIST,
    ],
  },
];

export function methodById(id: string | null | undefined): PlanMethod | undefined {
  return PLAN_METHODS.find((m) => m.id === id);
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface PlanData {
  story: Story;
  characters: Character[];
  /** The scenes: leaves of the structure tree, in reading order. */
  scenes: StructureNode[];
}

/** Characters a method asks about: everyone but walk-ons. */
export function mainCharacters(characters: Character[]): Character[] {
  return characters.filter((c) => c.role !== "tertiary");
}

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

export function characterDone(c: Character, fields: CharacterPlanField[]): boolean {
  return fields.every((f) => filled(c[f]));
}

/** How far along a step is. A step with nothing to count yet reads 0 of 1. */
export function stepProgress(step: PlanStep, data: PlanData): { done: number; total: number } {
  const t = step.target;
  if (t.kind === "story") return { done: filled(data.story[t.field]) ? 1 : 0, total: 1 };
  if (t.kind === "characters") {
    const main = mainCharacters(data.characters);
    if (main.length === 0) return { done: 0, total: 1 };
    return { done: main.filter((c) => characterDone(c, t.fields)).length, total: main.length };
  }
  if (data.scenes.length === 0) return { done: 0, total: 1 };
  return { done: data.scenes.filter((s) => filled(s.synopsis)).length, total: data.scenes.length };
}

export function isStepDone(step: PlanStep, data: PlanData): boolean {
  const { done, total } = stepProgress(step, data);
  return done === total;
}

/** The first step not yet done, or null when the whole method is. */
export function nextStep(method: PlanMethod, data: PlanData): PlanStep | null {
  return method.steps.find((s) => !isStepDone(s, data)) ?? null;
}

/**
 * The scenes a plan lists, in reading order: leaves at the template's deepest level, plus
 * any other leaf that already holds prose. An act with nothing in it yet is not a scene.
 */
export function sceneLeaves(
  nodes: StructureNode[],
  template: Pick<StoryStructureTemplate, "levels" | "flat"> | null,
): StructureNode[] {
  const deepest = template && !template.flat ? template.levels.length - 1 : 0;
  const out: StructureNode[] = [];
  const walk = (list: StructureNode[]) => {
    for (const n of [...list].sort((a, b) => a.position - b.position)) {
      if (n.children?.length) walk(n.children);
      else if (n.level >= deepest || n.word_count > 0) out.push(n);
    }
  };
  walk(nodes);
  return out;
}
