import type { BeatSheet, Character, PlotThread, StoryStructureTemplate, StructureNode } from "../../types";
import type { Finding } from "../../types/findings";
import type { SceneCast, SceneCastEntry } from "../../types/panel";
import { bySeverity, SEVERITY_LABELS } from "../findings/group";
import { slotVar } from "../colorSlots";
import { sceneLeaves } from "../planning/methods";

/**
 * The story strip's model (refactor doc 11, phase 3): the book as a transit line. Scenes
 * are stops, the level above them stations, the level above that acts, all read from the
 * story's template so a flat outline is a line of stops and a three-level one has both.
 * Pure, so the drawing components stay thin and this can be tested without a DOM.
 */
export const STRIP_WIDTHS = ["strip", "scenes"] as const;
export type StripWidth = (typeof STRIP_WIDTHS)[number];

export const COLOUR_MODES = [
  { id: "none", label: "Nothing, just position", short: "Plain", sub: "Behind you solid, ahead hollow" },
  { id: "cast", label: "Who's on the page", short: "Who", sub: "The character each scene is mostly about" },
  { id: "pov", label: "Whose eyes", short: "POV", sub: "The point-of-view character, planned scenes too" },
  { id: "threads", label: "Threads", short: "Threads", sub: "Every thread the scene carries" },
  { id: "status", label: "Draft status", short: "Status", sub: "Planned, draft, revised, final" },
  { id: "beat", label: "Story beat", short: "Beats", sub: "The beat sheet beat it carries" },
  { id: "findings", label: "Findings", short: "Findings", sub: "What needs your eye, worst first" },
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
  readout: Readout;
}

/** Where you are: "1 of 7", or how far through by words (the strip's readout toggles). */
export interface Readout {
  /** This chapter's or scene's number, or null when nothing is open. */
  position: number | null;
  total: number;
  unit: "chapter" | "scene";
  /** Words before here, as a share of the whole. */
  pct: number;
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
  // Grouped by level, not by parent: a stop's station is the node at the level above the
  // deepest (a chapter holding prose is its own station), its act the node at the top. A stop
  // with no node at that level (a scene straight under an act) is loose: on the line, unnumbered.
  const stationLevel = levels - 2;
  const at = (n: StructureNode | null | undefined, level: number): StructureNode | null => {
    for (let cur = n ?? null; cur; cur = up.get(cur.id) ?? null) if (cur.level === level) return cur;
    return null;
  };
  const hasStations = levels >= 2 && stops.some((s) => at(s.node, stationLevel));
  const hasActs = levels >= 3 && stops.some((s) => at(s.node, 0));

  const stations: Station[] = [];
  let numbered = 0;
  for (const stop of stops) {
    const stationNode = hasStations ? at(stop.node, stationLevel) : null;
    const actId = hasActs ? (at(stop.node, 0)?.id ?? "") : "";
    const key = stationNode?.id ?? (hasStations ? `loose:${actId}` : "root");
    const last = stations[stations.length - 1];
    if (last && last.key === key) last.stops.push(stop);
    else
      stations.push({
        key,
        node: stationNode,
        number: stationNode || !hasStations ? ++numbered : 0,
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
  let actCount = 0;
  for (const st of stations) {
    const actNode = hasActs ? at(st.node ?? st.stops[0].node, 0) : null;
    const key = actNode?.id ?? "root";
    const last = acts[acts.length - 1];
    if (last && last.key === key) last.stations.push(st);
    else
      acts.push({
        key,
        node: actNode,
        label: actNode || !hasActs ? roman(++actCount) : "",
        title: actNode?.title ?? "",
        stations: [st],
      });
  }

  // Safety net: an act or chapter whose parts are split by another's (dragged out of order).
  uniqueKeys(stations);
  uniqueKeys(acts);

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
  const inChapter = hasStations && !!currentStation?.node;
  const readout: Readout = {
    position: inChapter ? currentStation.number : currentIndex >= 0 ? currentIndex + 1 : null,
    total: inChapter ? numbered : stops.length,
    unit: inChapter ? "chapter" : "scene",
    pct,
  };

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

/** An act's or chapter's number in the whole book ("Act II", "Chapter 4 of 13"), or null. */
export function numberOf(
  line: Line,
  id: string,
): { kind: "act" | "chapter"; label: string; total: number } | null {
  const acts = line.acts.filter((a) => a.node);
  const act = acts.find((a) => a.node?.id === id);
  if (act) return { kind: "act", label: act.label, total: new Set(acts.map((a) => a.node?.id)).size };
  const stations = line.stations.filter((s) => s.node);
  const station = stations.find((s) => s.node?.id === id);
  if (station)
    return {
      kind: "chapter",
      label: String(station.number),
      total: new Set(stations.map((s) => s.node?.id)).size,
    };
  return null;
}

export interface ColourContext {
  characters: Character[];
  threads: PlotThread[];
  beatSheet: BeatSheet | null;
  /** The open findings, for the Findings mode. */
  findings?: Finding[];
  /** The book's own POV character, for a scene with none of its own (the Whose eyes mode). */
  storyPov?: string | null;
}

const SEVERITY_COLOUR = {
  high: "var(--color-danger)",
  mid: "var(--color-warning)",
  low: "var(--color-text-subtle)",
};
/** A stop shows at most this many findings as pips; the peek card and the page say the rest. */
const MAX_PIPS = 4;

export interface Swatch {
  color: string;
  label: string;
}

/** The colours a stop shows in a mode: none, one, or several (a scene carrying several threads). */
export function colourFor(mode: ColourMode, stop: Stop, ctx: ColourContext): Swatch[] {
  if (mode === "findings") {
    // A planned scene can carry findings too (an empty chapter); the planned skip is for prose modes.
    return (ctx.findings ?? [])
      .filter((f) => f.anchor.node_id === stop.node.id)
      .sort(bySeverity)
      .slice(0, MAX_PIPS)
      .map((f) => ({ color: SEVERITY_COLOUR[f.severity], label: SEVERITY_LABELS[f.severity] }));
  }
  if (mode === "pov") {
    // The viewpoint is decided while planning, so a planned scene shows it too.
    const id = stop.node.pov_character_id ?? ctx.storyPov;
    const c = id ? ctx.characters.find((x) => x.id === id) : undefined;
    return c ? [{ color: slotVar(c.color_slot), label: c.name }] : [];
  }
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
  if (mode === "findings") {
    const present = new Set(stops.flatMap((stop) => colourFor(mode, stop, ctx).map((s) => s.label)));
    return (["high", "mid", "low"] as const)
      .filter((sev) => present.has(SEVERITY_LABELS[sev]))
      .map((sev) => ({ color: SEVERITY_COLOUR[sev], label: SEVERITY_LABELS[sev] }));
  }
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

/**
 * Two states (doc 14 strip): collapsed to the line of dots, or expanded to the outline at
 * the width the author dragged it to. The outline is the one expanded view (doc 24: the
 * chapter rows it once had beside it showed the same book twice).
 */
/** The collapsed line, with the strip's 14px gutter from the window's edge (Strip.module.css). */
export const COLLAPSED_PX = 78;
export const EXPANDED_MIN_PX = 288;
export const EXPANDED_MAX_PX = 460;
export const EXPANDED_DEFAULT_PX = 304;

export function clampStripPx(px: number): number {
  if (!Number.isFinite(px)) return EXPANDED_DEFAULT_PX;
  return Math.round(Math.min(EXPANDED_MAX_PX, Math.max(EXPANDED_MIN_PX, px)));
}

/** The strip's width on screen. */
export function stripPx(width: StripWidth, expandedPx: number): number {
  return width === "strip" ? COLLAPSED_PX : clampStripPx(expandedPx);
}

/** Narrow the strip, or widen it. */
export function toggleStrip(width: StripWidth): StripWidth {
  return width === "strip" ? "scenes" : "strip";
}

/** Give a key that repeats a suffix, so each group renders as itself. */
function uniqueKeys(groups: { key: string }[]): void {
  const seen = new Map<string, number>();
  for (const g of groups) {
    const n = seen.get(g.key) ?? 0;
    seen.set(g.key, n + 1);
    if (n) g.key = `${g.key}:${n}`;
  }
}
