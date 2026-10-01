/**
 * The Numbers page's charts as data (doc 13 P3): every one is drawn from the scenes in
 * reading order and what `/scene-cast` says is in each, so the page needs no endpoint of
 * its own for them.
 */
import type { Beat } from "../../types/beats";
import type { SceneCastEntry } from "../../types/panel";
import type { Character, PlotThread, StructureNode } from "../../types";

export interface PacingBar {
  id: string;
  title: string;
  words: number;
  status: string;
  /** Which chapter (or whatever holds the scenes) the bar belongs to, for the gaps between groups. */
  group: string;
  /** How far through the book the bar ends, 0 to 1, by words. */
  through: number;
}

export interface BeatMark {
  id: string;
  name: string;
  /** Where the beat is meant to fall, 0 to 1. */
  at: number;
  /** The scene the author put it on, if any. */
  sceneId: string | null;
}

export function pacing(scenes: StructureNode[], cast: Map<string, SceneCastEntry>): PacingBar[] {
  const words = scenes.map((s) => cast.get(s.id)?.word_count ?? s.word_count ?? 0);
  const total = words.reduce((a, b) => a + b, 0);
  let running = 0;
  return scenes.map((s, i) => {
    running += words[i];
    return {
      id: s.id,
      title: s.title,
      words: words[i],
      status: cast.get(s.id)?.status ?? s.status ?? "draft",
      group: s.parent_id ?? "",
      through: total ? running / total : (i + 1) / scenes.length,
    };
  });
}

export function beatMarks(beats: Beat[], scenes: StructureNode[]): BeatMark[] {
  return beats.map((b) => ({
    id: b.id,
    name: b.name,
    at: Math.min(1, Math.max(0, b.position_pct / 100)),
    sceneId: scenes.find((s) => s.beat_id === b.id)?.id ?? null,
  }));
}

export interface Lane {
  thread: PlotThread;
  /** Indices of the scenes the thread appears in, in reading order. */
  hits: number[];
}

export function threadLanes(
  threads: PlotThread[],
  scenes: StructureNode[],
  cast: Map<string, SceneCastEntry>,
): Lane[] {
  return threads
    .map((thread) => ({
      thread,
      hits: scenes.flatMap((s, i) => (cast.get(s.id)?.thread_ids.includes(thread.id) ? [i] : [])),
    }))
    .sort((a, b) => (a.hits[0] ?? Infinity) - (b.hits[0] ?? Infinity));
}

export interface CastRow {
  character: Character;
  present: boolean[];
  count: number;
  first: number | null;
  last: number | null;
  /** Not on the page in the last `quietAfter` written scenes, though on it earlier. */
  quiet: boolean;
  milestones: { done: number; total: number };
}

export function castGrid(
  characters: Character[],
  scenes: StructureNode[],
  cast: Map<string, SceneCastEntry>,
  quietAfter = 3,
): CastRow[] {
  const written = scenes.map((s) => (cast.get(s.id)?.word_count ?? s.word_count ?? 0) > 0);
  const lastWritten = written.lastIndexOf(true);
  return characters
    .map((character) => {
      const present = scenes.map((s) => !!cast.get(s.id)?.character_ids.includes(character.id));
      const count = present.filter(Boolean).length;
      const first = present.indexOf(true);
      const last = present.lastIndexOf(true);
      const recent = written.flatMap((w, i) => (w ? [i] : [])).slice(-quietAfter);
      const quiet =
        count > 0 && lastWritten >= 0 && recent.length === quietAfter && recent.every((i) => !present[i]);
      const ms = character.arc_milestones ?? [];
      return {
        character,
        present,
        count,
        first: first < 0 ? null : first,
        last: last < 0 ? null : last,
        quiet,
        milestones: { done: ms.filter((m) => m.completed).length, total: ms.length },
      };
    })
    .sort((a, b) => b.count - a.count || a.character.name.localeCompare(b.character.name));
}
