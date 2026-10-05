/**
 * Whose eyes, scene by scene (series v2): the rotation of point-of-view characters through a
 * book. A scene's POV is its own, or the book's when it has none. Planned scenes count: the
 * viewpoint is decided while planning, before a word is written. Pure, for Numbers.
 */
import type { Character, StructureNode } from "../../types";

export interface PovRow {
  character: Character;
  /** Indexes of the scenes seen through them, in reading order. */
  scenes: number[];
  /** Scenes since their last, to the end of the book so far. */
  since: number;
  /** The longest run of scenes between two of theirs. */
  longestGap: number;
  /** Away much longer than the rotation's usual turn. */
  overdue: boolean;
}

export interface PovRotation {
  /** Each scene's POV character id, or null when it has none. */
  perScene: (string | null)[];
  rows: PovRow[];
}

export function povRotation(
  scenes: StructureNode[],
  storyPov: string | null | undefined,
  characters: Character[],
): PovRotation {
  const perScene = scenes.map((s) => s.pov_character_id ?? storyPov ?? null);
  const byId = new Map(characters.map((c) => [c.id, c]));
  const order: string[] = [];
  for (const id of perScene) if (id && byId.has(id) && !order.includes(id)) order.push(id);
  const n = scenes.length;
  const turns = new Map(order.map((id) => [id, perScene.flatMap((p, i) => (p === id ? [i] : []))]));
  // The usual turn: how many scenes it takes, across the book, to come round to the same eyes.
  const returns = [...turns.values()].flatMap((at) => at.slice(1).map((i, k) => i - at[k]));
  const turn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : order.length;
  const rows = order.map((id): PovRow => {
    const at = turns.get(id)!;
    const gaps = at.slice(1).map((i, k) => i - at[k] - 1);
    const since = n - 1 - at[at.length - 1];
    return {
      character: byId.get(id)!,
      scenes: at,
      since,
      longestGap: Math.max(0, ...gaps),
      overdue: order.length > 1 && since >= 3 && since > 2 * turn,
    };
  });
  return { perScene, rows };
}
