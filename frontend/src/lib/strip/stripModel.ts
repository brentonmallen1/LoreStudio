import type { BeatSheet, Character, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type { SceneCast, SceneCastEntry } from "../../types/panel";
import { slotVar } from "../colorSlots";
import { sceneLeaves } from "../planning/methods";

/**
 * The story strip's model (refactor doc 11, phase 3): the book as a transit line. Scenes
 * are stops, the level above them stations, the level above that acts, all read from the
 * story's template so a flat outline is a line of stops and a three-level one has both.
 * Pure, so the drawing components stay thin and this can be tested without a DOM.
 */
export const STRIP_WIDTHS = ["strip", "chapters", "scenes"] as const;
export type StripWidth = (typeof STRIP_WIDTHS)[number];

export const COLOUR_MODES = [
  { id: "none", label: "Nothing, just position", short: "Plain", sub: "Behind you solid, ahead hollow" },
  { id: "cast", label: "Who's on the page", short: "Who", sub: "The character each scene is mostly about" },
  { id: "threads", label: "Plot threads", short: "Threads", sub: "Every thread the scene carries" },
  { id: "status", label: "Draft status", short: "Status", sub: "Planned, draft, revised, final" },
  { id: "beat", label: "Story beat", short: "Beats", sub: "The beat sheet beat it carries" },
] as const;
export type ColourMode = (typeof COLOUR_MODES)[number]["id"];

export type StopShape = "dashed" | "hollow" | "filled" | "ringed";

/** Scene state as shape, whatever the colour mode: planned dashed, draft hollow, revised filled, final ringed. */
export function stopShape(status: string): StopShape {
  if (status === "planned") return "dashed";
  if (status === "revised") return "filled";
  if (status === "final") return "ringed";
  return "hollow";
}

export interface Stop {
  node: StructureNode;
  /** Position among all stops, from 0. */
  index: number;
  status: string;
  planned: boolean;
  words: number;
  cast?: SceneCastEntry;
}

export interface Station {
  key: string;
  node: StructureNode | null;
  /** 1-based, across the whole book. */
  number: number;
  title: string;
  stops: Stop[];
  words: number;
  planned: boolean;
  /** Share of its scenes marked final, 0..1. */
  done: number;
}

export interface Act {
  key: string;
  node: StructureNode | null;
  label: string;
  title: string;
  stations: Station[];
}

export interface Line {
  acts: Act[];
  stations: Station[];
  stops: Stop[];
  hasStations: boolean;
  hasActs: boolean;
  currentIndex: number;
  currentStationKey: string | null;
  currentActKey: string | null;
  totalWords: number;
  wordsBefore: number;
  readout: { top: string; bottom: string };
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export function roman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

function parents(
  nodes: StructureNode[],
  parent: StructureNode | null,
  out: Map<string, StructureNode | null>,
) {
  for (const n of nodes) {
    out.set(n.id, parent);
    if (n.children?.length) parents(n.children, n, out);
  }
  return out;
}

export function buildLine(
  structure: StructureNode[],
  template: StoryStructureTemplate | null,
  activeNodeId: string | null | undefined,
  cast: SceneCast | null,
): Line {
  const byScene = new Map((cast?.scenes ?? []).map((s) => [s.node_id, s]));
  const leaves = sceneLeaves(structure, template);
  const stops: Stop[] = leaves.map((node, index) => ({
    node,
    index,
    status: node.status,
    planned: node.status === "planned",
    words: node.word_count ?? 0,
    cast: byScene.get(node.id),
  }));
  const up = parents(structure, null, new Map());
  const levels = template && !template.flat ? template.levels.length : 1;
  const hasStations = levels >= 2 && stops.some((s) => up.get(s.node.id));
  const hasActs = levels >= 3 && stops.some((s) => up.get(up.get(s.node.id)?.id ?? "") ?? null);

  // Group consecutive stops by their parent, and parents by theirs.
  const stations: Station[] = [];
  for (const stop of stops) {
    const stationNode = hasStations ? (up.get(stop.node.id) ?? null) : null;
    const key = stationNode?.id ?? "root";
    const last = stations[stations.length - 1];
    if (last && last.key === key) last.stops.push(stop);
    else
      stations.push({
        key,
        node: stationNode,
        number: stations.length + 1,
        title: stationNode?.title ?? "",
        stops: [stop],
        words: 0,
        planned: false,
        done: 0,
      });
  }
  for (const st of stations) {
    st.words = st.stops.reduce((n, s) => n + s.words, 0);
    st.planned = st.stops.every((s) => s.planned);
    st.done = st.stops.filter((s) => s.status === "final").length / st.stops.length;
  }
  const acts: Act[] = [];
  for (const st of stations) {
    const actNode = hasActs && st.node ? (up.get(st.node.id) ?? null) : null;
    const key = actNode?.id ?? "root";
    const last = acts[acts.length - 1];
    if (last && last.key === key) last.stations.push(st);
    else
      acts.push({
        key,
        node: actNode,
        label: roman(acts.length + 1),
        title: actNode?.title ?? "",
        stations: [st],
      });
  }

  const currentIndex = stops.findIndex((s) => s.node.id === activeNodeId);
  const currentStation =
    stations.find((st) => st.node?.id === activeNodeId) ??
    stations.find((st) => st.stops.some((s) => s.node.id === activeNodeId)) ??
    null;
  const currentAct =
    acts.find((a) => a.node?.id === activeNodeId) ??
    acts.find((a) => currentStation && a.stations.includes(currentStation)) ??
    null;
  const totalWords = stops.reduce((n, s) => n + s.words, 0);
  const wordsBefore = stops.slice(0, Math.max(0, currentIndex)).reduce((n, s) => n + s.words, 0);
  const pct = totalWords ? Math.round((wordsBefore / totalWords) * 100) : 0;
  const readout =
    hasStations && currentStation
      ? { top: `Ch ${currentStation.number}`, bottom: `of ${stations.length} · ${pct}%` }
      : currentIndex >= 0
        ? { top: `Sc ${currentIndex + 1}`, bottom: `of ${stops.length} · ${pct}%` }
        : { top: `${stops.length}`, bottom: stops.length === 1 ? "scene" : "scenes" };

  return {
    acts,
    stations,
    stops,
    hasStations,
    hasActs,
    currentIndex,
    currentStationKey: currentStation?.key ?? null,
    currentActKey: currentAct?.key ?? null,
    totalWords,
    wordsBefore,
    readout,
  };
}

export interface ColourContext {
  characters: Character[];
  threads: PlotThread[];
  beatSheet: BeatSheet | null;
}

export interface Swatch {
  color: string;
  label: string;
}

/** The colours a stop shows in a mode: none, one, or several (a scene carrying several threads). */
export function colourFor(mode: ColourMode, stop: Stop, ctx: ColourContext): Swatch[] {
  if (stop.planned || mode === "none") return [];
  if (mode === "status") return [{ color: `var(--status-${stop.status})`, label: stop.status }];
  if (mode === "cast") {
    const id = stop.cast?.character_ids[0];
    const c = id ? ctx.characters.find((x) => x.id === id) : undefined;
    return c ? [{ color: slotVar(c.color_slot), label: c.name }] : [];
  }
  if (mode === "threads") {
    return (stop.cast?.thread_ids ?? [])
      .map((id) => ctx.threads.find((t) => t.id === id))
      .filter((t): t is PlotThread => !!t)
      .map((t) => ({ color: slotVar(t.color_slot), label: t.name }));
  }
  const beats = ctx.beatSheet?.beats ?? [];
  const i = beats.findIndex((b) => b.id === stop.node.beat_id);
  return i >= 0 ? [{ color: `var(--cat-${(i % 8) + 1})`, label: beats[i].name }] : [];
}

/** Every colour the mode uses across the book, once each, for the key. */
export function legendFor(mode: ColourMode, stops: Stop[], ctx: ColourContext): Swatch[] {
  if (mode === "status") {
    return [
      { color: "var(--status-draft)", label: "Draft" },
      { color: "var(--status-revised)", label: "Revised" },
      { color: "var(--status-final)", label: "Final" },
    ];
  }
  const seen = new Map<string, Swatch>();
  for (const stop of stops)
    for (const s of colourFor(mode, stop, ctx)) if (!seen.has(s.label)) seen.set(s.label, s);
  return [...seen.values()];
}

/** The next width when the handle is used: strip → chapters → scenes → strip; a flat template has no chapters stop. */
export function nextWidth(width: StripWidth, hasStations: boolean): StripWidth {
  const order: StripWidth[] = hasStations ? ["strip", "chapters", "scenes"] : ["strip", "scenes"];
  const i = order.indexOf(width);
  return order[(i + 1) % order.length];
}
