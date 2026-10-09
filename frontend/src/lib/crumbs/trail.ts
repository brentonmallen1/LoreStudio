import type { LucideIcon } from "lucide-react";
import type { Character, Location, PlotThread, StructureNode } from "../../types";
import type { UIMode } from "../mode";
import { slotVar } from "../colorSlots";
import { pathTo } from "../../components/layout/structureTreeMeta";
import { STORY_ROUTES, routesFor, sectionModes, type RouteSection, type StoryRoute } from "../routes";
import {
  colourFor,
  stopShape,
  type ColourContext,
  type ColourMode,
  type Line,
  type StopShape,
} from "../strip/stripModel";

/**
 * Where you are, as one trail on every story page (doc 24 P5, D15, "Explorer style"):
 * `Book › Page › Section › Entry`, or on the writing page `Book › Act › Chapter › Scene`.
 * Each crumb's words go to that place; the › after it is a menu of what is inside it, the
 * next crumb marked. The last crumb has a › too when it holds anything. Pure, so the header
 * stays thin and this is tested without a DOM.
 */

/** A crumb's colour mark: an entity's slot dot, a chapter's pips, a scene's status shape. */
export type CrumbMark =
  | { kind: "dot"; color: string }
  | { kind: "pips"; colors: string[] }
  | { kind: "stop"; shape: StopShape; color?: string };

export interface CrumbChild {
  key: string;
  label: string;
  to: string;
  mark?: CrumbMark;
  icon?: LucideIcon;
  /** A word at the row's end ("POV"). */
  hint?: string;
  /** A heading over a run of rows ("Pages"). */
  group?: string;
  /** The next crumb in the trail, or the page you are on. */
  current?: boolean;
  /** Someone or something the node's scenes carry: opens beside the prose, not in place of it. */
  open?: { kind: "character" | "location" | "thread"; id: string; name: string };
}

export interface Crumb {
  key: string;
  label: string;
  to: string;
  kind: "book" | "page" | "section" | "entry" | "node";
  mark?: CrumbMark;
  /** What is inside it: the › menu after it. Empty, and there is no ›. */
  children: CrumbChild[];
  /** The › button's name ("Pages in The Last Lighthouse"). */
  menuLabel: string;
}

export interface TrailInput {
  storyId: string;
  storyTitle: string;
  /** The address under `/stories/:storyId` ("/lorebook/characters/abc", "" for the Overview). */
  rest: string;
  mode: UIMode;
  aiAvailable: boolean;
  /** On the writing page, the node open (else the trail stops at the book). */
  nodeId?: string | null;
  structure: StructureNode[];
  line: Line;
  colourMode: ColourMode;
  ctx: ColourContext;
  characters: Character[];
  locations: Location[];
  threads: PlotThread[];
}

/** A chapter shows at most this many pips; the strip's peek card says the rest. */
const MAX_PIPS = 4;
/** A node's menu names at most this many of each (people, places, threads), most often first. */
const MAX_CAST = 6;

const untitled = (title: string | null | undefined) => title?.trim() || "Untitled";

/** The pages a story has, for the book's menu: the ones this mode shows, AI pages only with AI. */
export function storyPages(mode: UIMode, aiAvailable: boolean): StoryRoute[] {
  return routesFor(mode).filter((r) => !r.ai || aiAvailable);
}

export function visibleSections(route: StoryRoute, mode: UIMode, aiAvailable: boolean): RouteSection[] {
  return (route.sections ?? []).filter((s) => {
    const { modes, ai } = sectionModes(route, s);
    return modes.includes(mode) && (!ai || aiAvailable);
  });
}

/** The address split into its page, section and entry (any may be missing). */
export function parseStoryPath(rest: string): {
  route: StoryRoute | null;
  section: RouteSection | null;
  entryId: string | null;
} {
  const segs = rest.split("/").filter(Boolean);
  if (segs.length === 0)
    return { route: STORY_ROUTES.find((r) => r.path === "") ?? null, section: null, entryId: null };
  const route = STORY_ROUTES.find((r) => r.path === `/${segs[0]}`) ?? null;
  if (!route?.sections) return { route, section: null, entryId: segs[1] ?? null };
  const section =
    route.sections.find((s) => s.path === (segs[1] ? `/${segs[1]}` : "")) ??
    (segs[1] ? null : (route.sections[0] ?? null));
  return { route, section, entryId: section?.detailParam ? (segs[2] ?? null) : null };
}

/** The colour marks a node carries in the strip's current colour mode. */
export function nodeMark(
  node: StructureNode,
  line: Line,
  mode: ColourMode,
  ctx: ColourContext,
): CrumbMark | undefined {
  const stop = line.stops.find((s) => s.node.id === node.id);
  if (stop)
    return { kind: "stop", shape: stopShape(stop.status), color: colourFor(mode, stop, ctx)[0]?.color };
  const station = line.hasStations ? line.stations.find((st) => st.key === node.id) : undefined;
  if (!station) return undefined;
  const colors: string[] = [];
  for (const s of station.stops)
    for (const sw of colourFor(mode, s, ctx)) if (!colors.includes(sw.color)) colors.push(sw.color);
  return colors.length ? { kind: "pips", colors: colors.slice(0, MAX_PIPS) } : undefined;
}

/** Every scene under a node (or the node itself, when it is one). */
function scenesUnder(node: StructureNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (n: StructureNode) => (n.children ?? []).forEach((c) => (ids.add(c.id), walk(c)));
  walk(node);
  return ids;
}

/**
 * Who, where and which threads a node's scenes carry (doc 24: the › is a menu of what is in
 * a place, the people in it too), from the scene cast the strip reads: each most often first,
 * then in the order the prose names them. A person or place opens beside the prose.
 */
export function castOf(node: StructureNode, input: TrailInput): CrumbChild[] {
  const base = `/stories/${input.storyId}`;
  const ids = scenesUnder(node);
  const stops = input.line.stops.filter((s) => ids.has(s.node.id) && s.cast);
  const single = stops.length === 1 && stops[0].node.id === node.id;
  const tally = (pick: (c: NonNullable<(typeof stops)[number]["cast"]>) => string[]) => {
    const counts = new Map<string, number>();
    for (const s of stops) for (const id of pick(s.cast!)) counts.set(id, (counts.get(id) ?? 0) + 1);
    // A Map keeps first-seen order, so equal counts stay in the prose's order.
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CAST);
  };
  const pov = single ? (stops[0].node.pov_character_id ?? input.ctx.storyPov ?? null) : null;
  const rows: CrumbChild[] = [];
  const add = (
    group: string,
    kind: "character" | "location" | "thread",
    entries: [string, number][],
    find: (id: string) => Entity | undefined,
    to: string,
  ) => {
    for (const [id, n] of entries) {
      const e = find(id);
      if (!e) continue;
      rows.push({
        key: `${kind}:${id}`,
        label: untitled(e.name),
        to: `${base}${to}/${id}`,
        mark: { kind: "dot", color: slotVar(e.slot) },
        hint: id === pov ? "POV" : single ? undefined : `${n} ${n === 1 ? "scene" : "scenes"}`,
        group,
        open: { kind, id, name: e.name },
      });
    }
  };
  const asEntity = (x: { id: string; name: string; color_slot?: number | null } | undefined) =>
    x && { id: x.id, name: x.name, slot: x.color_slot };
  add(
    "Who is in it",
    "character",
    tally((c) => c.character_ids),
    (id) => asEntity(input.characters.find((c) => c.id === id)),
    "/lorebook/characters",
  );
  add(
    "Where",
    "location",
    tally((c) => c.location_ids),
    (id) => asEntity(input.locations.find((l) => l.id === id)),
    "/lorebook/places",
  );
  add(
    "Threads",
    "thread",
    tally((c) => c.thread_ids),
    (id) => asEntity(input.threads.find((t) => t.id === id)),
    "/promises/threads",
  );
  return rows;
}

/** "chapter" → "Chapters": the heading over a node's own children when its cast follows. */
const plural = (levelType: string | undefined) =>
  levelType ? `${levelType.charAt(0).toUpperCase()}${levelType.slice(1)}s` : "Inside";

interface Entity {
  id: string;
  name: string;
  slot: number | null | undefined;
}

/** The entries a section lists from the story store, when it is one the store holds. */
function sectionEntities(section: RouteSection, route: StoryRoute, input: TrailInput): Entity[] | null {
  const key = `${route.id}.${section.id}`;
  if (key === "lorebook.characters")
    return input.characters.map((c) => ({ id: c.id, name: c.name, slot: c.color_slot }));
  if (key === "lorebook.places")
    return input.locations.map((l) => ({ id: l.id, name: l.name, slot: l.color_slot }));
  if (key === "promises.threads")
    return input.threads.map((t) => ({ id: t.id, name: t.name, slot: t.color_slot }));
  return null;
}

export function buildTrail(input: TrailInput): Crumb[] {
  const { storyId, storyTitle, rest, mode, aiAvailable, structure, line, colourMode, ctx } = input;
  const base = `/stories/${storyId}`;
  const writing = /^\/write(\/|$)/.test(rest);
  const { route, section, entryId } = writing
    ? { route: STORY_ROUTES.find((r) => r.id === "write") ?? null, section: null, entryId: null }
    : parseStoryPath(rest);

  const nodeTrail = writing && input.nodeId ? (pathTo(structure, input.nodeId) ?? []) : [];
  const nodeChild = (n: StructureNode, current: boolean, group?: string): CrumbChild => ({
    key: n.id,
    label: untitled(n.title),
    to: `${base}/write/${n.id}`,
    mark: nodeMark(n, line, colourMode, ctx),
    group,
    current,
  });

  // The book: its menu is the pages, and on the writing page the book's top level first.
  const pages: CrumbChild[] = storyPages(mode, aiAvailable).map((r) => ({
    key: `page:${r.id}`,
    label: r.label,
    to: `${base}${r.path}`,
    icon: r.icon,
    group: writing ? "Pages" : undefined,
    current: r.id === route?.id,
  }));
  const top = writing ? structure.map((n) => nodeChild(n, n.id === nodeTrail[0]?.id, "In the book")) : [];
  const trail: Crumb[] = [
    {
      key: "book",
      label: untitled(storyTitle),
      to: base,
      kind: "book",
      children: [...top, ...pages],
      menuLabel: `Pages in ${untitled(storyTitle)}`,
    },
  ];

  if (writing) {
    nodeTrail.forEach((n, i) => {
      const next = nodeTrail[i + 1];
      const cast = castOf(n, input);
      const kids = n.children ?? [];
      // With people and places after them, the node's own children get a heading too.
      const group = cast.length ? plural(kids[0]?.level_type) : undefined;
      trail.push({
        key: n.id,
        label: untitled(n.title),
        to: `${base}/write/${n.id}`,
        kind: "node",
        mark: nodeMark(n, line, colourMode, ctx),
        children: [...kids.map((c) => nodeChild(c, c.id === next?.id, group)), ...cast],
        menuLabel: `In ${untitled(n.title)}`,
      });
    });
    return trail;
  }

  if (!route || route.path === "") return trail;
  const sections = visibleSections(route, mode, aiAvailable);
  trail.push({
    key: `page:${route.id}`,
    label: route.label,
    to: `${base}${route.path}`,
    kind: "page",
    children: sections.map((s) => ({
      key: `section:${s.id}`,
      label: s.label,
      to: `${base}${route.path}${s.path}`,
      icon: s.icon,
      current: s.id === section?.id,
    })),
    menuLabel: `${route.label} sections`,
  });
  if (!section) return trail;

  const entities = sectionEntities(section, route, input);
  const sectionTo = `${base}${route.path}${section.path}`;
  const entry = entryId ? entities?.find((e) => e.id === entryId) : undefined;
  trail.push({
    key: `section:${section.id}`,
    label: section.label,
    to: sectionTo,
    kind: "section",
    children: (entities ?? []).map((e) => ({
      key: e.id,
      label: untitled(e.name),
      to: `${sectionTo}/${e.id}`,
      mark: { kind: "dot", color: slotVar(e.slot) },
      hint:
        route.id === "lorebook" && section.id === "characters" && e.id === ctx.storyPov ? "POV" : undefined,
      current: e.id === entryId,
    })),
    menuLabel: section.label,
  });
  if (entry)
    trail.push({
      key: entry.id,
      label: untitled(entry.name),
      to: `${sectionTo}/${entry.id}`,
      kind: "entry",
      mark: { kind: "dot", color: slotVar(entry.slot) },
      children: [],
      menuLabel: entry.name,
    });
  return trail;
}
