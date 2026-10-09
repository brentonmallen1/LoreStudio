import type { Character } from "../../types";

/**
 * Who might say an untagged line, for the Dialogue view's speaker picker (doc 24, D17): the
 * people in the scene first (whose eyes, then how often the prose names them, then anyone
 * already speaking in it), then the rest of the cast by name. Each person once.
 */
export interface SpeakerChoices {
  inScene: Character[];
  rest: Character[];
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function speakerChoices(
  cast: Character[],
  {
    povId = null,
    sceneCharacterIds = [],
    speakerNames = [],
  }: {
    povId?: string | null;
    /** The scene's cast as the server reads it: point of view first, then by mentions. */
    sceneCharacterIds?: string[];
    /** Names already speaking in the scene, in reading order. */
    speakerNames?: (string | null | undefined)[];
  },
): SpeakerChoices {
  const byId = new Map(cast.map((c) => [c.id, c]));
  const byName = new Map<string, Character>();
  for (const c of cast) {
    for (const n of [c.name, ...(c.aliases ?? [])])
      if (norm(n) && !byName.has(norm(n))) byName.set(norm(n), c);
  }
  const inScene: Character[] = [];
  const seen = new Set<string>();
  const add = (c: Character | undefined) => {
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      inScene.push(c);
    }
  };
  if (povId) add(byId.get(povId));
  for (const id of sceneCharacterIds) add(byId.get(id));
  for (const name of speakerNames) add(byName.get(norm(name)));
  const rest = cast
    .filter((c) => !seen.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { inScene, rest };
}
