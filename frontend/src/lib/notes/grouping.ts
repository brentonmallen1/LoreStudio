import type { Note, NoteKind } from "../../types/notes";

/** Where a note is tied, in the story's own order (doc 15 N2). */
export interface NoteGroup {
  key: string;
  title: string;
  /** "character", "place", or the chapter a scene is in. */
  meta: string;
  /** Where the group's notes open: a scene to write in, a sheet, or nowhere. */
  to: { kind: "scene"; id: string } | { kind: "character" | "place"; id: string } | null;
  notes: Note[];
}

export interface GroupContext {
  /** The scenes in reading order, each with the chapter (or other parent) it is in. */
  scenes: { id: string; title: string; parent: string }[];
  characters: { id: string; name: string }[];
  places: { id: string; name: string }[];
}

export type NoteStatus = "open" | "done" | "all";

/** Answered questions and ticked to-dos are done; a note or an idea is always open. */
export function isOpen(n: Note): boolean {
  return !n.done;
}

export function filterNotes(notes: Note[], kinds: NoteKind[] | null, status: NoteStatus): Note[] {
  return notes.filter(
    (n) => (!kinds || kinds.includes(n.kind)) && (status === "all" || (status === "open") === isOpen(n)),
  );
}

export function countByKind(notes: Note[]): Record<NoteKind, number> {
  const out: Record<NoteKind, number> = { note: 0, question: 0, todo: 0, idea: 0 };
  for (const n of notes) out[n.kind] += 1;
  return out;
}

/**
 * Notes not tied to anything come first (they are waiting to be placed), then each scene in
 * reading order, then the characters and places they are about. A note whose scene or
 * subject is gone counts as not tied.
 */
export function groupNotes(notes: Note[], ctx: GroupContext): NoteGroup[] {
  const scenes = new Map(ctx.scenes.map((s, i) => [s.id, { ...s, i }]));
  const chars = new Map(ctx.characters.map((c) => [c.id, c.name]));
  const places = new Map(ctx.places.map((p) => [p.id, p.name]));
  const loose: Note[] = [];
  const byScene = new Map<string, Note[]>();
  const byAbout = new Map<string, Note[]>();
  for (const n of notes) {
    if (n.node_id && scenes.has(n.node_id)) {
      byScene.set(n.node_id, [...(byScene.get(n.node_id) ?? []), n]);
    } else if (n.about_id && (chars.has(n.about_id) || places.has(n.about_id))) {
      byAbout.set(n.about_id, [...(byAbout.get(n.about_id) ?? []), n]);
    } else loose.push(n);
  }
  const groups: NoteGroup[] = [];
  if (loose.length) groups.push({ key: "loose", title: "Not tied yet", meta: "", to: null, notes: loose });
  for (const [id, list] of [...byScene].sort((a, b) => scenes.get(a[0])!.i - scenes.get(b[0])!.i)) {
    const s = scenes.get(id)!;
    groups.push({
      key: id,
      title: s.title || "Untitled scene",
      meta: s.parent,
      to: { kind: "scene", id },
      notes: list,
    });
  }
  const about = [...byAbout].map(([id, list]) => {
    const isChar = chars.has(id);
    return {
      key: id,
      title: (isChar ? chars.get(id) : places.get(id)) ?? "",
      meta: isChar ? "character" : "place",
      to: { kind: isChar ? ("character" as const) : ("place" as const), id },
      notes: list,
    };
  });
  about.sort((a, b) =>
    a.meta === b.meta ? a.title.localeCompare(b.title) : a.meta === "character" ? -1 : 1,
  );
  return [...groups, ...about];
}
