/**
 * The Numbers page's charts as data (doc 13 P3): every one is drawn from the scenes in
 * reading order and what `/scene-cast` says is in each, so the page needs no endpoint of
 * its own for them.
 */
import type { Beat } from "../../types/beats";
import type { SceneCastEntry } from "../../types/panel";
import type { Character, PlotThread, StructureNode, ThreadRole } from "../../types";

/** Draft states in the order a scene moves through them, and their names. */
export const STATUSES = ["final", "revised", "draft", "planned"] as const;
export const STATUS_LABEL: Record<string, string> = {
  final: "Final",
  revised: "Revised",
  draft: "Draft",
  planned: "Planned",
};

export interface ChapterSpan {
  id: string;
  title: string;
  /** The first scene's index, and how many scenes in a row it holds. */
  first: number;
  count: number;
}

/**
 * The chapters (or whatever holds the scenes) as runs of columns, for the row of names over
 * every chart that has a column per scene. A book with no level above its scenes has none.
 */
export function chapterSpans(structure: StructureNode[], scenes: StructureNode[]): ChapterSpan[] {
  const byId = new Map<string, StructureNode>();
  const walk = (list: StructureNode[]) =>
    list.forEach((n) => {
      byId.set(n.id, n);
      if (n.children?.length) walk(n.children);
    });
  walk(structure);
  const spans: ChapterSpan[] = [];
  scenes.forEach((s, i) => {
    const last = spans[spans.length - 1];
    if (s.parent_id && last?.id === s.parent_id) last.count++;
    else if (s.parent_id)
      spans.push({ id: s.parent_id, title: byId.get(s.parent_id)?.title ?? "", first: i, count: 1 });
  });
  return spans;
}

/** The columns that open a chapter (the first excepted), where a grid draws its chapter rule. */
export function chapterStarts(chapters: ChapterSpan[]): Set<number> {
  return new Set(chapters.length > 1 ? chapters.slice(1).map((c) => c.first) : []);
}

/** A round number at or just above `max`, for the top of a scale: 560 becomes 600. */
export function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  const m = max / step;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * step;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

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

export interface LaneMark {
  /** The scene's index in reading order. */
  index: number;
  nodeId: string;
  /** What the scene does to the thread (doc 18). */
  role: ThreadRole;
  note: string;
}

export interface Lane {
  thread: PlotThread;
  /** The scenes the thread is in, in reading order, each with what it does there. */
  marks: LaneMark[];
}

export function threadLanes(threads: PlotThread[], scenes: StructureNode[]): Lane[] {
  const at = new Map(scenes.map((s, i) => [s.id, i]));
  return threads
    .map((thread) => ({
      thread,
      marks: (thread.appearances ?? [])
        .filter((a) => at.has(a.node_id))
        .map((a) => ({ index: at.get(a.node_id)!, nodeId: a.node_id, role: a.role, note: a.note }))
        .sort((a, b) => a.index - b.index),
    }))
    .sort((a, b) => (a.marks[0]?.index ?? Infinity) - (b.marks[0]?.index ?? Infinity));
}

export interface CastRow {
  character: Character;
  present: boolean[];
  /** The scenes seen through them: a stronger mark than only being on the page. */
  seenThrough: boolean[];
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
  /** Each scene's point-of-view character, as `povRotation` reads it. */
  povs: (string | null)[] = [],
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
        seenThrough: scenes.map((_, i) => present[i] && povs[i] === character.id),
        count,
        first: first < 0 ? null : first,
        last: last < 0 ? null : last,
        quiet,
        milestones: { done: ms.filter((m) => m.completed).length, total: ms.length },
      };
    })
    .sort((a, b) => b.count - a.count || a.character.name.localeCompare(b.character.name));
}
