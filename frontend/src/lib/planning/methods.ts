/**
 * Planning methods, as data (refactor doc 10). Every method is a route through the same
 * fields — the logline, the paragraph summary, the synopsis, each character's goal,
 * motivation, conflict and epiphany, and the scene list — so switching methods loses
 * nothing, and anything planned shows up wherever those fields do.
 *
 * Adding a method is adding an entry here; the Plan page, the Overview's next step and
 * Story Health all read this list.
 */
import type {
  BeatSheet,
  Character,
  PlotThread,
  Story,
  StoryStructureTemplate,
  StructureNode,
} from "../../types";

export type StoryPlanField = "logline" | "premise" | "central_conflict" | "paragraph_summary" | "synopsis";
export type CharacterPlanField =
  "mission_statement" | "motivation" | "conflict" | "epiphany" | "arc_in_own_words";

export type PlanTarget =
  | { kind: "story"; field: StoryPlanField }
  | { kind: "characters"; fields: CharacterPlanField[] }
  | { kind: "scenes" }
  /** The scenes that carry one beat of a beat sheet (StructureNode.beat_id). */
  | { kind: "beat"; beatId: string }
  /** MICE: the threads the story opens, each with its kind. */
  | { kind: "threads" }
  /** MICE: the scene where each thread opens and the one where it closes. */
  | { kind: "threadPlacement" };

/** A step of a method. Generic over what it edits, so the series plan (lib/series/plan.ts)
 * walks the same rail with its own targets. */
export interface PlanStep<T = PlanTarget> {
  id: string;
  label: string;
  /** One line: what the step is for. */
  why: string;
  /** How to write it. */
  how: string;
  /** From The Last Lighthouse, where there is one. */
  example?: string;
  target: T;
  /** Worth doing, not owed: the next step to suggest passes it by (a series' axes). */
  optional?: boolean;
  /** A story field shown above the editor as the thing this step grows from. */
  buildsOn?: StoryPlanField;
  /** Snowflake guidance layer for the AI (Studio mode only). */
  guidanceLayer?: string;
  /** Height of the text box for a story field. */
  rows?: number;
}

export interface PlanMethod<T = PlanTarget> {
  id: string;
  label: string;
  summary: string;
  steps: PlanStep<T>[];
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

const LOGLINE: PlanStep = {
  id: "logline",
  label: "The story in one sentence",
  why: "A sentence you can hold in your head while you write.",
  how: "Who, what they want, what stands in the way. Around 25 words.",
  example:
    "When a mysterious historian arrives in a storm, a reclusive lighthouse keeper must choose between guarding her secrets and facing what she's buried.",
  target: { kind: "story", field: "logline" },
  rows: 2,
};

export const PLAN_METHODS: PlanMethod[] = [
  {
    id: "essentials",
    label: "The essentials",
    summary: "Four questions: what it is, what's at stake, who wants what, and what happens.",
    steps: [
      LOGLINE,
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
  {
    id: "mice",
    label: "MICE threads",
    summary:
      "A story opens questions of place, idea, character and event, and closes them in the reverse order it opened them.",
    steps: [
      LOGLINE,
      {
        id: "threads",
        label: "The threads",
        why: "Every thread is a promise to the reader; knowing yours tells you what the ending owes.",
        how: "Name each thread and its kind: Milieu (a place to enter and leave), Idea (a question to answer), Character (a change to make), Event (a disruption to set right).",
        example: "Idea: what happened to the log entries? Character: will Eleanor let anyone in?",
        target: { kind: "threads" },
      },
      SCENE_LIST,
      {
        id: "placement",
        label: "Where each opens and closes",
        why: "Threads close in the reverse order they open, like nested brackets. A crossing is worth a second look.",
        how: "For each thread, the scene where it opens and the one where it closes.",
        example: "The missing-logs question opens in The Logbook and closes in What Thomas Knew.",
        target: { kind: "threadPlacement" },
      },
    ],
  },
];

function whereInStory(pct: number): string {
  if (pct <= 0) return "At the very start.";
  if (pct >= 100) return "At the very end.";
  return `Around ${Math.round(pct)}% of the way through.`;
}

/** A beat sheet as a method: its beats are the steps, each asking which scenes carry it. */
export function beatSheetMethod(sheet: BeatSheet): PlanMethod {
  return {
    id: `beats:${sheet.id}`,
    label: sheet.name,
    summary: sheet.description || `${sheet.beats.length} beats, each placed where it lands in the story.`,
    steps: [
      LOGLINE,
      ...[...sheet.beats]
        .sort((a, b) => a.position_pct - b.position_pct)
        .map((beat): PlanStep => ({
          id: `beat-${beat.id}`,
          label: beat.name,
          why: whereInStory(beat.position_pct),
          how: beat.description || "Which scene carries this beat? Say in a line what happens.",
          target: { kind: "beat", beatId: beat.id },
        })),
    ],
  };
}

/** Every method: the fixed ones, then one per beat sheet (the story's own ones included). */
export function planMethods(beatSheets: BeatSheet[] = []): PlanMethod[] {
  return [...PLAN_METHODS, ...beatSheets.map(beatSheetMethod)];
}

export function methodById(
  id: string | null | undefined,
  beatSheets: BeatSheet[] = [],
): PlanMethod | undefined {
  return planMethods(beatSheets).find((m) => m.id === id);
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface PlanData {
  story: Story;
  characters: Character[];
  /** The scenes: leaves of the structure tree, in reading order. */
  scenes: StructureNode[];
  /** Plot threads, for the MICE steps; null until loaded (those steps then read 0). */
  threads?: PlotThread[] | null;
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
  if (t.kind === "beat") {
    const carried = data.scenes.some((s) => s.beat_id === t.beatId && filled(s.synopsis));
    return { done: carried ? 1 : 0, total: 1 };
  }
  if (t.kind === "threads" || t.kind === "threadPlacement") {
    const typed = (data.threads ?? []).filter((th) => th.mice_type);
    if (t.kind === "threads") return { done: typed.length ? 1 : 0, total: 1 };
    if (typed.length === 0) return { done: 0, total: 1 };
    return {
      done: typed.filter((th) => th.opens_at_node_id && th.closes_at_node_id).length,
      total: typed.length,
    };
  }
  if (data.scenes.length === 0) return { done: 0, total: 1 };
  return { done: data.scenes.filter((s) => filled(s.synopsis)).length, total: data.scenes.length };
}

export function isStepDone(step: PlanStep, data: PlanData): boolean {
  const { done, total } = stepProgress(step, data);
  return done === total;
}

/** The first step owed and not yet done, given how to measure one; null when none is. */
export function firstOpen<T>(
  steps: PlanStep<T>[],
  progress: (step: PlanStep<T>) => { done: number; total: number },
): PlanStep<T> | null {
  return (
    steps.find((s) => {
      if (s.optional) return false;
      const { done, total } = progress(s);
      return done < total;
    }) ?? null
  );
}

/** The first step not yet done, or null when the whole method is. */
export function nextStep(method: PlanMethod, data: PlanData): PlanStep | null {
  return firstOpen(method.steps, (s) => stepProgress(s, data));
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

/**
 * Threads that cross instead of nesting: B opens inside A and closes after A does. A handover
 * (B opens in the scene A closes) is not a crossing. Pairs of names, for a gentle warning, not
 * a rule. The server's check (services/mice_validation.py) has the same rule.
 */
export function crossingThreads(threads: PlotThread[], scenes: StructureNode[]): [string, string][] {
  const at = new Map(scenes.map((s, i) => [s.id, i]));
  const spans = threads
    .filter((t) => t.mice_type && t.opens_at_node_id && t.closes_at_node_id)
    .map((t) => ({
      name: t.name,
      open: at.get(t.opens_at_node_id!) ?? -1,
      close: at.get(t.closes_at_node_id!) ?? -1,
    }))
    .filter((t) => t.open >= 0 && t.close >= t.open);
  const out: [string, string][] = [];
  for (const a of spans)
    for (const b of spans)
      if (a.open < b.open && b.open < a.close && a.close < b.close) out.push([a.name, b.name]);
  return out;
}
