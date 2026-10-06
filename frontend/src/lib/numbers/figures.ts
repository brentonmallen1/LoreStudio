/**
 * Everything the Numbers page draws, from either side of a comparison (doc 19): the story as
 * it is (the numbers endpoint plus the workspace's stores) or a reading taken earlier. A
 * reading is turned into the same inputs the live page has, so `charts.ts` draws both with
 * the same code and a column means the same thing on each side.
 */
import type { Beat, BeatSheet } from "../../types/beats";
import type { SceneCastEntry } from "../../types/panel";
import type { Character, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type {
  NumbersDialogue,
  NumbersProse,
  NumbersSummaries,
  NumbersWords,
  ReadingData,
  StoryNumbers,
} from "../../types/numbers";
import { sceneLeaves } from "../planning/methods";
import {
  beatMarks,
  castGrid,
  chapterSpans,
  pacing,
  threadLanes,
  type BeatMark,
  type CastRow,
  type ChapterSpan,
  type Lane,
  type PacingBar,
} from "./charts";
import { povRotation, type PovRotation } from "./pov";

export interface Figures {
  words: NumbersWords;
  dialogue: Pick<NumbersDialogue, "total_lines" | "unattributed" | "balance" | "speakers"> &
    Partial<Pick<NumbersDialogue, "pairs" | "monologue_scenes">>;
  prose: NumbersProse | null;
  summaries: NumbersSummaries;
  /** Open findings by kind; null where they were not kept (a reading of an earlier version). */
  findings: Record<string, number> | null;
  scenes: StructureNode[];
  characters: Pick<Character, "id" | "name" | "color_slot">[];
  threads: Pick<PlotThread, "id" | "name" | "status">[];
  bars: PacingBar[];
  beats: BeatMark[];
  lanes: Lane[];
  cast: CastRow[];
  rotation: PovRotation;
  chapters: ChapterSpan[];
}

function charts(
  scenes: StructureNode[],
  cast: Map<string, SceneCastEntry>,
  structure: StructureNode[],
  threads: PlotThread[],
  characters: Character[],
  beats: Beat[],
  storyPov: string | null | undefined,
) {
  const rotation = povRotation(scenes, storyPov, characters);
  return {
    bars: pacing(scenes, cast),
    beats: beatMarks(beats, scenes),
    lanes: threadLanes(threads, scenes),
    cast: castGrid(characters, scenes, cast, 3, rotation.perScene),
    rotation,
    chapters: chapterSpans(structure, scenes),
  };
}

/** The story as it is: the numbers endpoint and the workspace's stores. */
export function liveFigures(
  data: StoryNumbers,
  live: {
    structure: StructureNode[];
    activeTemplate: Pick<StoryStructureTemplate, "levels" | "flat"> | null;
    sceneCast: { scenes: SceneCastEntry[] } | null;
    threads: PlotThread[];
    characters: Character[];
    beatSheets: BeatSheet[];
    beatSheetId: string | null | undefined;
    storyPov: string | null | undefined;
    /** Open findings by kind, from the Findings store, when it has loaded. */
    findings: Record<string, number> | null;
  },
): Figures {
  const scenes = sceneLeaves(live.structure, live.activeTemplate);
  const cast = new Map((live.sceneCast?.scenes ?? []).map((e) => [e.node_id, e]));
  const sheet = live.beatSheets.find((b) => b.id === live.beatSheetId);
  return {
    ...data,
    findings: live.findings,
    scenes,
    characters: live.characters,
    threads: live.threads,
    ...charts(scenes, cast, live.structure, live.threads, live.characters, sheet?.beats ?? [], live.storyPov),
  };
}

/** A reading, as the same inputs the live page has. */
export function readingFigures(r: ReadingData): Figures {
  const scenes = r.scenes.map(
    (s) =>
      ({
        id: s.id,
        title: s.title,
        parent_id: s.parent_id,
        word_count: s.words,
        status: s.status,
        beat_id: s.beat_id,
        pov_character_id: s.pov,
        children: [],
      }) as unknown as StructureNode,
  );
  const cast = new Map(
    r.scenes.map((s): [string, SceneCastEntry] => [
      s.id,
      {
        node_id: s.id,
        character_ids: s.characters,
        location_ids: [],
        thread_ids: s.threads.map((t) => t.id),
        beat_id: s.beat_id,
        status: s.status,
        word_count: s.words,
        opening: "",
      },
    ]),
  );
  const threads = r.threads.map(
    (t) =>
      ({
        ...t,
        color_slot: t.color_slot ?? 0,
        appearances: r.scenes.flatMap((s) =>
          s.threads.filter((a) => a.id === t.id).map((a) => ({ node_id: s.id, role: a.role, note: a.note })),
        ),
      }) as unknown as PlotThread,
  );
  const characters = r.characters.map(
    (c) =>
      ({
        id: c.id,
        name: c.name,
        color_slot: c.color_slot ?? 0,
        arc_milestones: Array.from({ length: c.arc.total }, (_, i) => ({ completed: i < c.arc.done })),
      }) as unknown as Character,
  );
  const chapters = r.chapters.map((c) => ({ id: c.id, title: c.title }) as unknown as StructureNode);
  const beats = r.beats.map((b) => ({ id: b.id, name: b.name, position_pct: b.at * 100 }) as unknown as Beat);
  return {
    words: r.words,
    dialogue: r.dialogue,
    prose: r.prose,
    summaries: r.summaries,
    findings: r.findings,
    scenes,
    characters,
    threads,
    ...charts(scenes, cast, chapters, threads, characters, beats, r.story_pov),
  };
}
