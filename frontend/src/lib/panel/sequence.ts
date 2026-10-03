import type { StoryStructureTemplate, StructureNode } from "../../types";
import { buildLine, type Station } from "../strip/stripModel";
import { readerText } from "../prose/syntax";

/**
 * The open scene in its sequence (the side panel's This scene tab): the scene before it and
 * the scene after it, and where a chapter ends or begins between them. The panel reads top
 * to bottom as time: how the last scene ended, this one from entry to exit, where the next
 * one picks up.
 */
export interface SequenceSide {
  node: StructureNode;
  /** "End of Chapter 3: Old Records" (before) or "Chapter 5: The Truth of It begins" (after). */
  chapterBreak: string | null;
}

export interface Sequence {
  /** 1-based among every scene, and how many there are. */
  position: number;
  total: number;
  /** The chapter the scene sits in, named for the reader ("Chapter 4: What the Storm Carries"). */
  chapter: string | null;
  /** Null at the story's edges: the first scene has nothing before it, the last nothing after. */
  before: SequenceSide | null;
  after: SequenceSide | null;
}

/** A chapter's name: its title, led by its level and number when the title does not say it. */
export function stationName(station: Station, levelName: string | undefined): string {
  const title = station.title.trim();
  const level = levelName?.trim();
  if (!level) return title || `Part ${station.number}`;
  if (!title) return `${level} ${station.number}`;
  return title.toLowerCase().startsWith(level.toLowerCase()) ? title : `${level} ${station.number}: ${title}`;
}

export function sceneSequence(
  structure: StructureNode[],
  template: StoryStructureTemplate | null,
  nodeId: string,
): Sequence | null {
  const line = buildLine(structure, template, nodeId, null);
  const index = line.currentIndex;
  // A chapter's own page, or a node the line does not count as a scene: no sequence.
  if (index < 0 || line.stops[index].node.id !== nodeId) return null;
  const stationOf = new Map<string, Station>();
  for (const st of line.stations) for (const s of st.stops) stationOf.set(s.node.id, st);
  const name = (st: Station | undefined) => {
    if (!line.hasStations || !st?.node) return null;
    return stationName(st, template?.levels[st.node.level]?.name);
  };
  const here = stationOf.get(nodeId);
  const side = (i: number, edge: "end" | "begin"): SequenceSide | null => {
    const stop = line.stops[i];
    if (!stop) return null;
    const there = stationOf.get(stop.node.id);
    const crossed = there !== here ? name(there) : null;
    return {
      node: stop.node,
      chapterBreak: crossed && (edge === "end" ? `End of ${crossed}` : `${crossed} begins`),
    };
  };
  return {
    position: index + 1,
    total: line.stops.length,
    chapter: name(here),
    before: side(index - 1, "end"),
    after: side(index + 1, "begin"),
  };
}

/** How much of a neighbouring scene's prose to show: a choice of three, no more. */
export const PROSE_AMOUNTS = [1, 3, 6] as const;
export type ProseAmount = (typeof PROSE_AMOUNTS)[number];
export const DEFAULT_PROSE_AMOUNT: ProseAmount = 3;

/** The prose's paragraphs as a reader sees them: no markup, no mention or speaker syntax. */
export function proseParagraphs(html: string | null | undefined): string[] {
  if (!html?.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const blocks = doc.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
  const texts = blocks.length ? [...blocks].map((b) => b.textContent ?? "") : [doc.body.textContent ?? ""];
  return texts.map((t) => readerText(t).trim()).filter(Boolean);
}

/** The last paragraphs of the scene before, or the first of the scene after. */
export function excerpt(paragraphs: string[], amount: number, from: "start" | "end"): string[] {
  return from === "start" ? paragraphs.slice(0, amount) : paragraphs.slice(-amount);
}
